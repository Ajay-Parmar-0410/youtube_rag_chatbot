# Parallel Prefetch System — Implementation Plan

## Problem

Users wait 10-15 seconds per tab click (Brief, Detailed, Flashcards, Topics) because each tab triggers: transcript fetch → LLM call → response. Goal: prefetch everything in background as soon as a video URL is pasted, so tab switches are instant.

## Architecture

Two coordinated layers:

1. **Backend**: New `/prefetch` SSE endpoint orchestrating transcript + vectorstore + staggered LLM calls, storing results in existing caches
2. **Frontend**: `usePrefetch` hook triggered on `videoId` change, consumes SSE stream, feeds results into ContentPanel state

## Expected Timing

| Metric | Before | After |
|--------|--------|-------|
| Brief summary | 10-15s after click | 0s (pre-cached) |
| Detailed summary | 10-15s after click | 0s (pre-cached) |
| Flashcards | 10-15s after click | 0s (pre-cached) |
| Topics | 10-15s after click | 0s (pre-cached) |
| Q&A first question | 10-20s | 2-5s (vectorstore pre-built) |

All prefetching happens during the ~15-20s the user spends watching the video load.

## Rate Limit Strategy

- **Gemini** (summaries): 20 RPD. Fire one summary at a time. On 429, fall back to Groq 8b.
- **Groq 8b** (flashcards, topics): 30K tokens/min. Sequential within prefetch — safe.
- **Vectorstore**: Local embeddings, no API rate limits.
- **Deduplication**: Track active prefetch jobs per `video_id` to prevent duplicates.

## Sequencing

```
t=0s     fetch_transcript()             [1-5s, cached after first call]
t=1s     get_or_create_store()          [5-15s, local embeddings, background]
t=1s     summary("brief", gemini)       [2-8s, Gemini API]
t=5s     summary("detailed", gemini)    [2-8s, Gemini API, after brief completes]
t=9s     flashcards(groq 8b)            [1-3s, Groq API]
t=11s    topics(groq 8b)                [1-3s, Groq API]
         ─────────────────────────────────
         Total wall time: ~13-18s
         Brief ready at: ~5-10s (before most users click)
```

---

## Step 1: Add flashcards & topics caches (`rag/cache.py`)

Add two new LRU cache singletons + key helpers. No breaking changes.

```python
# Add after existing singletons:
flashcards_cache = LRUCache(max_size=50)
topics_cache = LRUCache(max_size=50)

def make_flashcards_key(video_id: str) -> str:
    raw = f"{video_id}:flashcards"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

def make_topics_key(video_id: str) -> str:
    raw = f"{video_id}:topics"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
```

**Why**: Flashcards and topics routes currently have no cache. Adding caches here means prefetch can store results that the existing routes will find on cache hit — zero-cost tab switches.

---

## Step 2: Add cache layer to flashcards & topics routes

**Files**: `rag/routes/flashcards.py`, `rag/routes/topics.py`

Mirror the pattern from `routes/summary.py`:
- Import new caches from `cache.py`
- Check cache at top of handler (return early on hit with `X-Cache-Status: hit`)
- Store result in cache before returning on miss

```python
# In flashcards.py — add at top of generate_flashcards():
cache_key = make_flashcards_key(request.video_id)
cached = flashcards_cache.get(cache_key)
if cached is not None:
    response.headers["X-Cache-Status"] = "hit"
    return ApiResponse(success=True, data=cached)

# ... existing logic ...

# Before return:
flashcards_cache.put(cache_key, response_data.model_dump())
```

Same pattern for `topics.py`.

**Standalone improvement** — even without prefetch, repeated clicks won't re-call LLM.

---

## Step 3: Add Pydantic models (`rag/models.py`)

Add prefetch-specific request/event models:

```python
class PrefetchRequest(BaseModel, frozen=True):
    video_id: str = Field(..., min_length=1, max_length=20)
    language: str | None = None

class PrefetchEvent(BaseModel, frozen=True):
    task: str       # "transcript"|"brief"|"detailed"|"flashcards"|"topics"|"vectorstore"
    status: str     # "started"|"complete"|"error"
    error: str | None = None
    data: Any = None
```

---

## Step 4: Create prefetch engine (`rag/prefetch.py` — NEW ~200 lines)

Core orchestration class `PrefetchManager`:

```python
class PrefetchManager:
    _active_jobs: dict[str, asyncio.Task]   # prevents duplicates per video_id

    async def start_prefetch(video_id, language) -> AsyncGenerator[PrefetchEvent]:
        # 1. Fetch transcript (reuses transcript_cache)
        # 2. Start vectorstore build (get_or_create_store) as background task
        # 3. Generate brief summary → cache in summary_cache
        # 4. Generate detailed summary → cache in summary_cache
        # 5. Generate flashcards → cache in flashcards_cache
        # 6. Extract topics → cache in topics_cache
        # 7. Yield PrefetchEvent after each task completes
```

**Key reuse points** (import from existing modules, don't duplicate):
- `fetch_transcript` from `transcript.py`
- `get_or_create_store` from `store_manager.py`
- `create_summary_chain` from `chain.py`
- `FLASHCARD_PROMPT`, `TOPICS_PROMPT` from `prompts.py`
- `_parse_flashcards` / `_parse_topics` — extract from routes into shared helpers or import directly
- All caches from `cache.py`

**Rate limit handling**: Catch 429 / `RESOURCE_EXHAUSTED`, retry once with `force_groq=True` for summaries or skip with error event for flashcards/topics.

**Deduplication**: If `video_id` already has an active job, return existing generator (don't start a new one).

---

## Step 5: Create SSE route (`rag/routes/prefetch.py` — NEW ~100 lines)

```python
@router.post("")
async def prefetch_video(request: PrefetchRequest) -> StreamingResponse:
    # Validate video_id with VIDEO_ID_PATTERN
    # Get PrefetchManager singleton
    # Return StreamingResponse(content_type="text/event-stream")
    # Each SSE event: data: {"task": "brief", "status": "complete", "data": {...}}\n\n
```

SSE format:
```
data: {"task": "transcript", "status": "started"}\n\n
data: {"task": "transcript", "status": "complete"}\n\n
data: {"task": "brief", "status": "started"}\n\n
data: {"task": "brief", "status": "complete", "data": {"summary": "...", "mode": "brief"}}\n\n
...
```

---

## Step 6: Mount route (`rag/main.py`)

```python
from routes.prefetch import router as prefetch_router
app.include_router(prefetch_router, prefix="/prefetch", tags=["prefetch"])
```

---

## Step 7: Add frontend constants (`lib/constants.ts`)

```typescript
// In API_ENDPOINTS:
prefetch: "/api/prefetch",

// In TIMEOUTS:
prefetch: 120_000,
```

---

## Step 8: Create Next.js proxy route (`app/api/prefetch/route.ts` — NEW ~60 lines)

Proxies the SSE stream from Python backend to the browser:
- Validate `videoId` (11-char pattern)
- Rate limit check
- Forward POST to `RAG_SERVICE_URL/prefetch`
- Pipe the response stream through (SSE passthrough)
- Set `Content-Type: text/event-stream` on response

Pattern: similar to `app/api/summary/route.ts` but returns a streaming response instead of JSON.

---

## Step 9: Create `usePrefetch` hook (`lib/prefetch.ts` — NEW ~130 lines)

```typescript
interface PrefetchStatus {
  transcript: "pending" | "loading" | "complete" | "error";
  brief: "pending" | "loading" | "complete" | "error";
  detailed: "pending" | "loading" | "complete" | "error";
  flashcards: "pending" | "loading" | "complete" | "error";
  topics: "pending" | "loading" | "complete" | "error";
  vectorstore: "pending" | "loading" | "complete" | "error";
}

interface PrefetchData {
  brief?: string;
  detailed?: string;
  flashcards?: Flashcard[];
  topics?: Topic[];
}

export function usePrefetch(videoId: string, language: string): {
  status: PrefetchStatus;
  data: PrefetchData;
}
```

Implementation:
- On `videoId` change, opens `fetch()` to `/api/prefetch` with `ReadableStream` reader
- Parses SSE events line-by-line, updates `status` + `data` state immutably
- Aborts on `videoId` change or component unmount (via `AbortController`)
- Stores received data for immediate consumption by tabs

---

## Step 10: Integrate into ContentPanel (`components/ContentPanel.tsx`)

Changes:
1. Import and call `usePrefetch(videoId, language)` at component top
2. When `prefetchData.brief` arrives → set into `summaryCache.brief`
3. When `prefetchData.detailed` arrives → set into `summaryCache.detailed`
4. When `prefetchData.flashcards` arrives → pass as prop to FlashcardViewer
5. When `prefetchData.topics` arrives → pass as prop to TopicsList
6. Add **status indicator dots** on tab buttons:
   - Gray = pending
   - Spinning/yellow = loading
   - Green = ready
   - Red = error
7. Keep existing `loadSummaryContent` as **fallback** if prefetch hasn't finished when user clicks tab

Integration with existing reset logic in `useEffect` for video change — prefetch auto-restarts because `usePrefetch` watches `videoId`.

---

## Step 11: Update FlashcardViewer & TopicsList

**Files**: `components/FlashcardViewer.tsx`, `components/TopicsList.tsx`

Add optional `prefetchedData` prop:

```typescript
// FlashcardViewer
interface FlashcardViewerProps {
  readonly videoId: string;
  readonly prefetchedFlashcards?: readonly Flashcard[];  // NEW
}
// When prefetchedFlashcards provided and non-empty:
//   - Auto-populate state (no "Generate" button click needed)
//   - Button text becomes "Regenerate"

// TopicsList — same pattern with prefetchedTopics
```

When `prefetchedData` prop changes from `undefined` to populated, update internal state via `useEffect`. Don't overwrite if user has already clicked "Regenerate".

---

## Files Summary

| File | Action | Est. Lines Changed |
|------|--------|-------------------|
| `rag/cache.py` | MODIFY | +15 |
| `rag/models.py` | MODIFY | +15 |
| `rag/routes/flashcards.py` | MODIFY | +15 |
| `rag/routes/topics.py` | MODIFY | +15 |
| `rag/prefetch.py` | **CREATE** | ~200 |
| `rag/routes/prefetch.py` | **CREATE** | ~100 |
| `rag/main.py` | MODIFY | +3 |
| `lib/constants.ts` | MODIFY | +3 |
| `app/api/prefetch/route.ts` | **CREATE** | ~60 |
| `lib/prefetch.ts` | **CREATE** | ~130 |
| `components/ContentPanel.tsx` | MODIFY | +40 |
| `components/FlashcardViewer.tsx` | MODIFY | +20 |
| `components/TopicsList.tsx` | MODIFY | +20 |

---

## Verification Plan

### Automated

1. **Python lint**: `ruff check` on all modified/created Python files
2. **TypeScript check**: `npx tsc --noEmit` on all TS changes
3. **Backend unit tests** (`rag/tests/test_prefetch.py`):
   - Prefetch engine caches transcript, summaries, flashcards, topics
   - Rate limit fallback works (mock 429)
   - Duplicate prefetch jobs deduplicated
   - SSE events emitted in correct order
4. **Cache tests** (`rag/tests/test_cache_integration.py`):
   - Flashcards route returns cache hit after prefetch
   - Topics route returns cache hit after prefetch
5. **Frontend tests** (`tests/prefetch.test.ts`):
   - `usePrefetch` hook state transitions
   - Cleanup on videoId change
   - Error handling

### Manual (after implementation)

```bash
# 1. Start backend
cd rag && ./venv/Scripts/python -m uvicorn main:app --reload --port 8000

# 2. Test prefetch SSE endpoint — watch events stream in
curl -N -X POST http://localhost:8000/prefetch \
  -H "Content-Type: application/json" \
  -d '{"video_id":"dQw4w9WgXcQ"}'

# 3. Verify caches populated — should be instant (<100ms)
curl -X POST http://localhost:8000/summary \
  -H "Content-Type: application/json" \
  -d '{"video_id":"dQw4w9WgXcQ","mode":"brief"}'

curl -X POST http://localhost:8000/flashcards \
  -H "Content-Type: application/json" \
  -d '{"video_id":"dQw4w9WgXcQ"}'

curl -X POST http://localhost:8000/topics \
  -H "Content-Type: application/json" \
  -d '{"video_id":"dQw4w9WgXcQ"}'

# 4. Open browser, paste URL, verify tab switches are instant
```

---

## Implementation Order

Steps 1-2 are standalone cache improvements (safe to ship independently).
Steps 3-6 are the backend prefetch engine.
Steps 7-8 are the Next.js proxy layer.
Steps 9-11 are frontend integration.

Each group can be verified independently before moving to the next.
