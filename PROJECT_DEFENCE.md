# YouTube RAG Pipeline — Project Defence Document

**Audience:** myself, preparing to defend this project in interviews.
**Scope:** the RAG pipeline only — transcript fetching, chunking, embeddings,
vector search, generation, and the evaluation harness. Frontend (Next.js,
Supabase, auth, UI components) is out of scope of this document.

> Anything you say in an interview should be defensible from this document
> AND from the actual code in `rag/`. If a question goes beyond what's
> here, fall back to "let me reason from first principles" rather than
> guessing.

---

## 1. Elevator Pitch

> "I built a Retrieval-Augmented Generation pipeline that lets users ask
> grounded questions about any YouTube video. It fetches the transcript
> (with three fallbacks), chunks it with a recursive character splitter,
> embeds the chunks with Google's `gemini-embedding-001` model, stores
> them in an in-memory FAISS index, retrieves the top-k relevant chunks
> for each question, and answers using Llama 3.3 70B via Groq through a
> LangChain LCEL chain. I also built an evaluation harness with 20
> hand-labeled Q&A pairs across 4 educational videos that measures
> retrieval accuracy (hit@k, MRR) and end-to-end latency (p50, p95).
> The current pipeline hits 90% top-3 retrieval accuracy and ~1.1 s p50
> latency."

Three sentences for the resume question, three minutes for the followup,
three hours of code in `rag/` if they want to read it.

---

## 2. High-Level Architecture

```
                               ┌─────────────────────────────┐
                               │  YouTube transcript source  │
                               │ (3 providers w/ fallback)   │
                               └──────────────┬──────────────┘
                                              │  raw text
                                              ▼
   ┌─────────────────────────┐    ┌────────────────────────────┐
   │ user question           │    │ RecursiveCharacterTextSplit │
   │ "What is self attention"│    │ chunk_size=1000 overlap=200 │
   └──────────┬──────────────┘    └──────────────┬─────────────┘
              │                                  │ N chunks
              │                                  ▼
              │                    ┌──────────────────────────────┐
              │                    │ gemini-embedding-001 (Google)│
              │                    │  -> 768-dim float vectors    │
              │                    └──────────────┬───────────────┘
              │                                   │
              │                                   ▼
              │                    ┌──────────────────────────────┐
              │                    │ FAISS in-memory vector store │
              │                    │ cosine similarity index      │
              │                    └──────────────┬───────────────┘
              │ embed query (same model)          │
              ▼                                   │
   ┌─────────────────────────────┐                │
   │ retriever.invoke(question)  │ ←──────────────┘
   │ → top-k chunks (k=4 default)│
   └──────────┬──────────────────┘
              │ retrieved chunks (context)
              ▼
   ┌─────────────────────────────────────────┐
   │ LCEL chain: prompt | LLM | StrOutput   │
   │ Groq llama-3.3-70b-versatile (primary)  │
   │      → llama-3.1-8b-instant (fallback)  │
   └──────────┬──────────────────────────────┘
              │
              ▼
        grounded answer
```

The whole pipeline lives under `rag/` and is exposed as a FastAPI
service (`main.py`) that the Next.js frontend calls over HTTP.

---

## 3. End-to-End Request Walkthrough

A single Q&A request. Read this once and you can narrate the entire
pipeline in an interview without notes.

1. **Frontend POST** to FastAPI (`/qa`) with `{video_id, question}`.
2. **Transcript lookup** in `rag/transcript.py::fetch_transcript`:
   - Returns from in-memory LRU cache if seen before.
   - Otherwise tries 3 providers in order: `youtube-transcript-api`
     (Python lib, fastest), `yt-dlp` (handles videos where the lib fails),
     `faster-whisper` (last resort — downloads audio and transcribes).
   - First provider to return a transcript wins; result is cached.
3. **Vector store build** in `rag/vectorstore.py::create_vectorstore`:
   - Wraps the transcript in a `Document`.
   - `RecursiveCharacterTextSplitter` splits it on `["\n\n", "\n", ". ", " ", ""]`
     with `chunk_size=1000`, `chunk_overlap=200`.
   - Each chunk is embedded with `gemini-embedding-001` and inserted
     into a FAISS index (`FAISS.from_documents`).
4. **Retrieval** in `rag/vectorstore.py::get_retriever`:
   - `vectorstore.as_retriever(search_kwargs={"k": 4})`.
   - When the user submits a question, the retriever embeds the question
     with the same model, runs cosine-similarity search in FAISS, and
     returns the top 4 chunks.
5. **Generation** in `rag/chain.py::create_qa_chain`:
   - LCEL chain: `RunnableParallel(context=retriever | format_docs, question=Passthrough, chat_history=...)`
     `| QA_PROMPT | ChatGroq | StrOutputParser`.
   - Llama 3.3 70B by default. If 70B hits a rate limit, the upstream
     route catches the exception and rebuilds the chain with
     `lightweight=True` → Llama 3.1 8B.
6. **Response** streams back to the frontend as plain text inside an
   `ApiResponse` envelope.

---

## 4. Tech Stack — Every Choice With Why

For each row: **what** it is, **why** it's there, **what I rejected** and
why. This is the most-asked interview area.

### 4.1 Transcript fetching — `youtube-transcript-api` + `yt-dlp` + `faster-whisper`

- **What:** three providers tried in order in `transcript.py`.
- **Why:** YouTube transcript availability is unreliable. `youtube-transcript-api`
  works for most videos but fails on age-gated, private-caption, or some
  region-locked content. `yt-dlp` succeeds on a different superset.
  `faster-whisper` is a last-resort audio-to-text fallback that always
  works (at the cost of latency and CPU). Three providers stacked >
  one-and-done.
- **Rejected alternatives:**
  - **OpenAI Whisper API** — paid, and you still need the audio first.
    `faster-whisper` runs locally with int8 quantisation on CPU.
  - **Google Speech-to-Text** — same story; locks me into Google billing
    on top of the embedding cost.
  - **Single provider (`youtube-transcript-api` only)** — earlier prototype
    failed on ~10% of test URLs.

### 4.2 Chunking — `RecursiveCharacterTextSplitter`, size=1000, overlap=200

- **What:** LangChain's recursive splitter, splits by paragraph → line →
  sentence → word → character, falling back only when the larger separator
  doesn't keep the chunk under `chunk_size`.
- **Why:** transcripts are long-form prose. Splitting by paragraph/sentence
  preserves semantic boundaries far better than fixed-window splitting,
  while still being deterministic (no model call needed). Cheap and fast.
- **Why these numbers:**
  - `chunk_size=1000` chars (~250 tokens) — large enough to contain a
    self-contained idea (one concept explained for ~30 seconds of
    speech), small enough that 4 chunks ≈ 1000 tokens of context fit
    comfortably in the LLM input budget without dominating the prompt.
  - `chunk_overlap=200` (20%) — protects against losing answers that
    straddle a chunk boundary. 20% is the LangChain-recommended default
    and matches what I saw working in the eval harness (chunk_size=500
    with overlap=200 = 40% overlap was wasteful; 1000/200 was the sweet
    spot).
- **Rejected alternatives:**
  - **Semantic chunking** (LlamaIndex / LangChain experimental) — would
    require an additional embedding pass *during* ingest just to find
    boundaries. Costs more, and on hand-labeled benchmarks the hit@3
    improvement was marginal versus recursive character splitting.
  - **Fixed-size token splitting** — ignores natural sentence/paragraph
    boundaries; tends to slice mid-sentence and hurts retrieval.
  - **Sliding-window character splitting** — strictly worse than recursive
    on prose: same overlap cost without the natural-boundary benefit.

### 4.3 Embeddings — Google `gemini-embedding-001`

- **What:** 768-dim embeddings via `langchain-google-genai`.
- **Why:**
  - Free tier with usable rate limits (100 RPM is enough for a typical
    20-minute video that yields ~80 chunks).
  - Strong quality on text-similarity benchmarks (Google's claim is
    competitive with `text-embedding-3-small`).
  - Simple HTTPS API; no GPU/local install needed.
- **Rejected alternatives:**
  - **OpenAI `text-embedding-3-small`** — better quality marginally, but
    paid. Free Gemini covered the resume claim.
  - **Sentence-Transformers (`all-MiniLM-L6-v2`)** — free, runs locally,
    but adds ~200 MB of model weights to the deploy image and bumped the
    Railway free-tier deploy time past 5 minutes. (See commit `b26d49a`
    "fix: remove heavy deps causing Railway build timeout" and `773618c`
    "fix: switch embeddings from HuggingFace to Google API".) Honest
    answer: I started with Sentence-Transformers, hit a deploy size
    limit, swapped to Gemini, and it worked.
  - **Cohere embeddings** — proprietary, paid, and no obvious quality
    advantage for short transcript chunks.

### 4.4 Vector store — FAISS (`langchain-community.vectorstores.FAISS`)

- **What:** Facebook AI Similarity Search; in-memory index built per
  request (one FAISS index per video).
- **Why:**
  - Fast: sub-millisecond search for ~80 chunks. Not the bottleneck.
  - Zero infrastructure: no separate vector DB to deploy/operate.
  - Index is ephemeral, which fits the use case — each YouTube video gets
    a fresh index, throw it away when the user is done.
- **Rejected alternatives:**
  - **Pinecone / Weaviate / Qdrant** — managed vector DBs are great when
    you have a *persistent corpus*. Here the corpus is per-video and
    short-lived; standing up a network call to a managed DB is more
    latency and more cost for no gain.
  - **Chroma** — almost did this. Fine choice. Picked FAISS because
    LangChain's FAISS integration was slightly more mature at the time
    and FAISS itself is the de facto standard.
  - **PostgreSQL with `pgvector`** — interesting but adds a network hop
    for every retrieval. Not worth it for in-flight transcripts.

### 4.5 LLM (Q&A) — Groq `llama-3.3-70b-versatile` with 8B fallback

- **What:** ChatGroq client, primary model 70B Llama 3.3, fallback model
  8B Llama 3.1.
- **Why:**
  - Groq's hardware (LPUs) gives ~10× the tokens-per-second of the big
    proprietary providers — directly visible in p50 latency.
  - 70B is competitive with GPT-4o-mini on reading-comprehension tasks
    (which is exactly what RAG Q&A is).
  - Free tier exists, with documented rate limits — easy to reason about.
  - Fallback to 8B isn't a quality compromise on RAG (where context does
    most of the heavy lifting) and keeps the user from seeing failures
    when the daily token budget is hit.
- **Rejected alternatives:**
  - **OpenAI GPT-4o** — more expensive, slower per-token, no clear win
    for RAG-style Q&A.
  - **Anthropic Claude** — same. Also no free tier for development.
  - **Local Llama via Ollama** — fine for dev, terrible for production
    latency on commodity hardware.
  - **Gemini Flash** — used for *summarization* (high RPM, large context
    window) but Groq's latency wins for *interactive Q&A*. Both live in
    `chain.py` for that reason: Q&A → Groq, summary → Gemini.

### 4.6 Orchestration — LangChain LCEL

- **What:** LangChain Expression Language. Chains expressed as `runnable
  | runnable | runnable`.
- **Why:**
  - Async by default (`ainvoke`).
  - Trivially composable: `RunnableParallel` for fan-out, `|` for serial
    pipelines, `RunnablePassthrough` for "just pass the input through".
  - Standard interface — every component (retriever, prompt, LLM, parser)
    speaks the same `Runnable` protocol.
- **Rejected alternatives:**
  - **Hand-rolled chain** — feasible (it's not much code) but you give up
    streaming, async, and the standard observability hooks for nothing.
  - **LlamaIndex** — heavier, more opinionated about indexing. Overkill
    for a single-collection-per-video pipeline.

### 4.7 API layer — FastAPI

- **What:** `rag/main.py` registers route modules under `/qa`,
  `/summary`, `/transcript`, etc.
- **Why:** async, fast, type-driven (Pydantic), trivial to deploy on
  Railway. Pydantic models in `rag/models.py` give a single source of
  truth for request/response schemas.
- **Rejected alternatives:** Flask (sync, more boilerplate), Django
  (massive overkill for an API service).

### 4.8 Why the resume bullet says "Python, FAISS, LangChain"

Those are the three things that *uniquely identify the pipeline*. The
LLM provider and embedding provider are commodity choices that I can and
have swapped. FAISS + LangChain + Python is the spine.

---

## 5. Configuration Choices In Detail

Defending each number in `rag/config.py`.

| Setting | Value | Defence |
|---|---|---|
| `CHUNK_SIZE` | 1000 chars | ~250 tokens. Big enough for one self-contained idea, small enough that 4–5 chunks fit comfortably in prompt budget. Eval shows hit@3=90% at this size. |
| `CHUNK_OVERLAP` | 200 chars | 20% — LangChain-recommended; matches my best eval result. Lower overlap loses answers on chunk boundaries; higher overlap wastes embeddings. |
| `RETRIEVAL_K` | 4 | Sweet spot from the latency bench: k=3 is fastest but loses 5–10% recall; k=8 is 6× slower with no recall gain on this dataset. k=4 is a defensible middle. |
| `MODEL_NAME` | `llama-3.3-70b-versatile` | Best Groq model for RAG Q&A at the time of build. |
| `LIGHTWEIGHT_MODEL` | `llama-3.1-8b-instant` | Rate-limit fallback. Llama 3.1 8B Instant is Groq's fastest model. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Used only for summarization (high RPM, 1M-token context). |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | See §4.3. |

The defence for every value is "I measured it and it's the best on my
eval set" or "it's a published default with no measured downside". Never
"because it felt right".

---

## 6. Component Deep-Dive

### 6.1 `rag/transcript.py`

- Public function: `fetch_transcript(video_id) -> TranscriptResponse`.
- LRU cache layer on top (`cache.transcript_cache`) — same video twice
  in a row hits the cache and returns instantly.
- Three providers tried in order; on each failure the error is appended
  to a list and the next is tried. If all three fail, the aggregated
  error list is raised inside `TranscriptFetchError` so the user sees a
  useful message.
- The provider abstraction is just an `async` function `(video_id) ->
  TranscriptResponse`. Easy to add a fourth.

### 6.2 `rag/embeddings.py`

- `get_embeddings()` returns a `GoogleGenerativeAIEmbeddings` instance
  cached via `functools.lru_cache(maxsize=1)`. Avoids re-instantiating
  the client (which would re-validate auth) on every call.

### 6.3 `rag/vectorstore.py`

- `create_vectorstore(documents)`:
  - Splits with `RecursiveCharacterTextSplitter`.
  - Raises `ValueError` if splitting produced zero chunks (defensive — a
    bad transcript would otherwise silently embed an empty list).
  - Embeds and indexes with `FAISS.from_documents`.
- `get_retriever(vectorstore, k=4)`:
  - Returns a LangChain retriever. Honours `k` argument; falls back to
    `settings.RETRIEVAL_K` if `k <= 0`.

### 6.4 `rag/chain.py`

- `create_qa_chain(retriever, language?, lightweight?, chat_history?)`:
  - Multilingual mode (when `language` is set) uses a different prompt
    that explicitly instructs the LLM to respond in the named language,
    which is critical when the transcript is in language A but the user
    asked in language B.
  - `chat_history` is a list of `(role, content)` tuples threaded into
    the prompt so follow-up questions ("what about the next layer?")
    have context.
  - LCEL composition:
    ```python
    context_and_question = RunnableParallel(
        context=retriever | format_docs,
        question=RunnablePassthrough(),
        chat_history=lambda _: history,
    )
    return context_and_question | prompt | llm | StrOutputParser()
    ```
  - That's the entire RAG chain. Every component is swappable.
- `create_summary_chain(...)`:
  - Routes to Gemini for `mode="detailed"` (huge context window) and to
    Groq's 8B for everything else (faster, fits in token budget).

### 6.5 `rag/main.py`

- FastAPI app with CORS for `localhost:3000` (dev). Routes are split
  into `routes/qa.py`, `routes/summary.py`, etc.
- Global exception handler returns a `{success: False, error: ...}`
  envelope for any uncaught exception so the frontend never sees a raw
  500 page.

---

## 7. Evaluation — The Big One

This is where the resume bullets ("80% top-3 accuracy", "30% latency
reduction") actually have to be defensible. The harness lives in
`rag/eval/` and produces JSON outputs you can read at any time.

### 7.1 Why evaluate at all?

Without evaluation, a RAG pipeline is a pile of plausible-looking code
that could be returning hallucinated nonsense and no one would know.
"It looks like it works" is not an engineering claim. The eval harness
turns claims into numbers.

### 7.2 Dataset — what I built and why

`rag/eval/dataset.py` defines `EVAL_DATASET`: 4 real YouTube videos × 5
questions = 20 labeled Q&A pairs.

| Video | Topic | Reason for inclusion |
|---|---|---|
| 3Blue1Brown — But what is a neural network? | NN basics | Clean, well-structured pedagogical video; baseline difficulty |
| 3Blue1Brown — Gradient descent | Optimization | Same channel, different topic — checks no channel-specific overfit |
| Andrej Karpathy — Let's build GPT from scratch | Transformer code-along | Long, dense, code-heavy transcript — hardest case |
| 3Blue1Brown — LLMs explained briefly | LLMs | Modern topic; checks recent terminology |

Each question has an `expected_substring` — a distinctive phrase that
*must* appear in the chunk containing the correct answer. Substrings
are picked by reading the actual transcripts (so they're genuinely
present), kept short (so whitespace/punctuation normalisation matters
less), and made distinctive enough that they're unlikely to appear by
coincidence in the wrong chunk.

**Why this design instead of "judge by GPT-4"?**
- Reproducible — the same dataset gives the same numbers on every run.
  No LLM judge variance.
- Cheap — string matching costs zero.
- Defensible — if a recruiter pushes back, I can show the dataset, the
  matcher logic, and the source transcript line. There's no black box.

**Why 4 videos × 5 questions and not 100?**
- 20 hand-labeled pairs gives enough resolution to distinguish
  "definitely working" from "broken" (a 5%-point change is one query).
- Each labeled pair takes ~5 minutes of human time (read transcript,
  pick distinctive phrase, write question). 100 pairs is two days.
  Tradeoff was made deliberately for build velocity.
- The harness scales — adding videos and questions to `dataset.py` is a
  three-line edit and rerun.

### 7.3 Metrics — what I measure and why

**hit@k (k = 1, 3, 5)** — was the correct chunk in the top-k retrieved?
- Why: it's the *retrieval* metric. If hit@k is bad, no LLM can fix it
  because the right context isn't in the prompt.
- hit@1 = strictest (only top result counts). hit@3 = the resume claim
  (matches `RETRIEVAL_K=4` in production with one slot of slack).
  hit@5 = upper bound on what bigger k could ever buy you.

**MRR (Mean Reciprocal Rank)** — average of `1/rank` across all queries
(rank = position of first hit, 0 if not in top-k).
- Why: hit@k tells you "did the right thing land in top-k or not", but
  doesn't reward putting the right answer at rank 1 vs rank 3. MRR does.
  An MRR of 1.0 = always rank 1; 0.5 = always rank 2; 0.0 = never found.
- A high MRR (≥0.8) means the retriever is *confident*, not just lucky.

**End-to-end latency p50 / p95** — wall-clock time per
`chain.ainvoke(question)`.
- Why p50: representative of the typical user experience.
- Why p95: representative of the *worst common* user experience (1 in 20
  requests). p99 is too noisy at 20-trial sample size; p95 is the right
  granularity here.

**What I deliberately did NOT measure (and would defend skipping):**
- **BLEU/ROUGE on generated answers** — not RAG metrics. They measure
  surface-form overlap with a reference answer, which penalises perfectly
  good paraphrases and rewards copy-paste. Wrong tool for the job.
- **Faithfulness / hallucination rate via LLM-as-judge** — important in
  general, but: (a) requires another paid LLM call per query, (b)
  introduces judge-LLM bias, (c) wasn't claimed on the resume. Honest
  answer: out of scope, would add if pushed.
- **Cost per query** — would be useful for prod, but free-tier APIs make
  the per-query dollar number ~zero anyway.

### 7.4 How the numbers are computed

**Retrieval eval (`rag/eval/retrieval_eval.py`):**

For each (video, question) pair:

1. Build a fresh FAISS store from the video's transcript using the
   target chunk_size/overlap.
2. Get a retriever with `k=5` (max hit window measured).
3. Call `retriever.invoke(question)`.
4. Walk the returned chunks in rank order; the *rank* is the position
   (1-indexed) of the first chunk whose lowercased text contains the
   question's `expected_substring`. If no chunk matches, rank is `null`.
5. Aggregate: `hit@1 = mean(rank ≤ 1)`, `hit@3 = mean(rank ≤ 3)`,
   `hit@5 = mean(rank ≤ 5)`, `MRR = mean(1/rank if rank else 0)`.

**Latency bench (`rag/eval/latency_bench.py`):**

For each `(chunk_size, k)` config:

1. Build the FAISS store once per chunk_size (expensive — embeds the
   whole transcript), reuse it for all `k` values within that
   chunk_size.
2. For each video × question:
   - Run `warmup` calls of `chain.ainvoke(question)` whose times are
     discarded (covers cold-cache effects: first LLM connection, first
     query embedding).
   - Run `trials` measured calls; record `time.perf_counter()` deltas.
3. Aggregate per config: p50 = linear-interpolated median, p95 =
   95th percentile, plus mean / min / max for sanity.
4. Compute "best vs baseline" reduction percentage, where baseline =
   biggest `k`, smallest chunk (most retrieval work) and best = lowest
   p95.

### 7.5 Final results

**Retrieval (chunk_size=1000, overlap=200, k=5, n=20):**

| Metric | Score |
|---|---|
| hit@1 | 75.0% |
| hit@3 | **90.0%** |
| hit@5 | 90.0% |
| MRR | 0.825 |

**End-to-end latency (cleanest measurements):**

- Best: `chunk_size=1000, k=3` → p50 **1093 ms**, p95 1437 ms.
- Baseline (k=8, same chunk size): p50 8388 ms.
- p50 reduction best-vs-baseline: **~87%** (resume claim was 30%).

(Caveat: some 1000/k=5 and 1000/k=8 measurements were polluted by
free-tier daily token throttling. The k=3 numbers and the
chunk_size=500 row are the cleanest; full table and caveats live in
`rag/eval/BENCHMARKS.md`.)

### 7.6 How I conclude / defend each claim

**"90% top-3 retrieval accuracy across 20 labeled Q&A pairs."**
- Source: `rag/eval/results_retrieval.json`, field `hit_at_3 = 0.9`.
- Reproducible: `python -m eval.retrieval_eval --chunk-size 1000
  --chunk-overlap 200 --k 5`.
- Failure analysis: the only 2 misses are both on Karpathy's GPT video,
  on the query/key/value and dot-product-scaling questions. Both sit
  past the 50k-char truncation boundary I had to apply to fit Gemini's
  100 RPM free-tier quota. With the full transcript indexed, hit@3
  recovers toward 100% on that video.

**"~67–87% end-to-end latency reduction by tuning retrieval config."**
- Source: `rag/eval/BENCHMARKS.md` table.
- The 67% number is the cleanest comparison: same chunk size (500), k=8
  vs k=3 — 3357 ms → 1104 ms p50.
- The 87% number is best vs baseline across the entire grid.
- Resume says "30%". The actual measurement is well above that, so the
  claim holds. If I update the resume, I'll update it to "~67%" using
  the cleanest measurement, not "87%" (the throttle-affected one).

**"What if they ask 'what's your validation set vs test set?'"**
- Honest answer: the 20-question dataset *is* the test set; there's no
  separate validation set because I'm not training anything. The
  hyperparameters (chunk_size, overlap, k) were swept on this same set,
  so technically there's no held-out data — that's a limitation. With
  more time I'd label another 20 pairs as a held-out test set and tune
  on the first 20.

### 7.7 Reproducibility

```bash
cd rag
python -m eval.retrieval_eval --chunk-size 1000 --chunk-overlap 200 --k 5 \
    --max-chars 50000 --cooldown 65
python -m eval.latency_bench --chunk-sizes 500 1000 --ks 3 5 8 \
    --warmup 2 --trials 3 --max-chars 50000 --cooldown 65 \
    --videos aircAruvnKk IHZwWFHWa-w LPZh9BOjkQs
```

Cached transcripts under `rag/eval/fixtures/<video_id>.json` mean reruns
don't re-fetch from YouTube and don't burn API quota on transcripts.

---

## 8. Trade-offs Accepted

| Trade-off | Accepted because |
|---|---|
| Index is rebuilt per video, in memory | Per-video corpus is short-lived; persistence isn't needed; avoids vector DB ops |
| Free-tier APIs (Gemini 100 RPM, Groq 100k TPD) | Resume project, not paid prod; rate limits handled with `--cooldown` and 8B fallback |
| 20-question eval set | Build velocity; harness scales — extending is mechanical |
| No streaming response yet | LCEL supports it; not wired through the FastAPI route. Would add for prod UX |
| No held-out test set | Documented; would split if I had 40+ labels |
| Hard truncation on long transcripts (Karpathy) | Free-tier embedding rate; paid tier removes this entirely |

---

## 9. Known Limitations

1. **Long videos hit free-tier embedding limits.** Karpathy's 108k-char
   transcript needs 130+ embedding calls; Gemini free is 100 RPM. The
   bench truncates to 50k as a workaround. Paid tier or local
   Sentence-Transformers fixes this.
2. **In-memory FAISS dies with the process.** Every server restart
   re-builds every index. Fine for ephemeral usage; would persist to
   disk or use a managed store for prod.
3. **No deduplication of near-identical chunks.** A speaker who
   re-explains the same point creates two near-identical chunks; both
   can land in top-k and waste a slot.
4. **English-first assumptions.** Transcript fallbacks try English first
   and translate if not available. Non-English videos work but go through
   an extra translation step.
5. **No re-ranking.** A cross-encoder re-ranker on the top-20 retrieved
   chunks would likely push hit@1 from 75% toward 90%+. Skipped for
   simplicity and latency.

---

## 10. Likely Interview Questions — Answers

**Q: Walk me through what happens when a user asks a question.**
> See §3. Memorise that walkthrough.

**Q: Why RAG instead of just feeding the whole transcript to GPT-4?**
> Three reasons. (1) Cost — a 90-minute video transcript can be 80k+
> tokens, multiplied by every question. RAG drops that to ~1k tokens of
> retrieved context. (2) Latency — generation time scales with input
> tokens. (3) Quality — long-context LLMs degrade in the middle of the
> context ("lost in the middle"). Retrieving the most relevant chunks
> avoids that.

**Q: How does cosine similarity work, and why is FAISS fast?**
> Cosine similarity = dot product of L2-normalised vectors. FAISS is fast
> because (a) the index is in-memory and contiguous, so similarity
> computation vectorises with SIMD, and (b) for larger corpora it offers
> approximate-NN structures (IVF, HNSW) that prune the search space. For
> our ~80-chunk corpora we don't even need approximation — flat L2 is
> sub-millisecond.

**Q: What's MRR and why use it over accuracy?**
> Mean Reciprocal Rank = average of `1/rank-of-first-correct-result`. It
> rewards putting the right answer high; plain accuracy doesn't
> distinguish "rank 1" from "rank 5". MRR captures retriever confidence,
> not just retriever correctness.

**Q: Your resume says "Sentence-Transformers". I see Gemini in the
code. Explain.**
> Honest answer: I started with Sentence-Transformers, hit a deploy-time
> dependency-size limit on Railway (the model weights are ~200 MB),
> swapped to Gemini's API. The resume bullet is being updated to match
> the code. The eval numbers are from the Gemini-embeddings code that's
> in the repo today.

**Q: Why these specific chunk_size and overlap values?**
> See §5. They came out of the eval harness. 1000/200 is the best on my
> dataset; smaller chunks lost the answer to boundary effects, larger
> chunks wasted prompt tokens.

**Q: What would you do differently if you had to scale this to 1M
videos?**
> Three changes. (1) Persistent vector store — managed (Pinecone) or
> self-hosted (Qdrant). One collection per video doesn't scale; I'd shard
> by content. (2) Background ingest — transcript fetching + embedding
> moves to a worker queue, not the request path. (3) Re-ranker — a
> cross-encoder on top-20 retrieved would meaningfully bump hit@1.

**Q: How do you handle hallucinations?**
> Two layers. (1) The QA prompt instructs the model to answer only from
> provided context and say "I don't know" if the context doesn't cover
> it. (2) For deeper guarantees I'd add LLM-as-judge faithfulness
> scoring; that's not in the current pipeline. I'd be honest about that
> in an interview.

**Q: Why Groq over OpenAI?**
> Latency. Groq runs Llama on LPUs at hundreds of tokens/sec. OpenAI is
> faster than it used to be, but for a chat-style RAG flow the felt
> difference is noticeable. Plus free-tier and predictable pricing.

**Q: Walk me through your evaluation methodology.**
> See §7. The five-bullet version: hand-labeled 20 Q&A pairs across 4
> diverse videos, each with a distinctive `expected_substring`; built a
> harness that rebuilds the FAISS index per video, runs the query
> through the retriever, and checks whether any top-k chunk contains the
> expected substring; metrics are hit@k for k∈{1,3,5} and MRR; for
> latency, separate bench runs `chain.ainvoke` and records p50/p95.

**Q: How do you know your metrics are reliable with only 20 questions?**
> I don't, fully. 20 is enough to distinguish "working" from "broken"
> but not enough to distinguish, say, "89% hit@3" from "91% hit@3". For
> that I'd need ~100. I'd be honest about that in an interview, then
> point to the per-query JSON output: anyone can read which 2 of 20
> failed and decide for themselves whether the failure pattern is
> systematic.

**Q: Why didn't you use semantic chunking?**
> Tried it on a smaller benchmark; the recall lift over recursive
> character splitting was within noise, and semantic chunking adds an
> embedding pass at ingest time. Cost-vs-benefit didn't justify it.
> Resume now reflects "recursive character splitter".

**Q: What if YouTube blocks the transcript API?**
> Three providers in fallback order. If `youtube-transcript-api` fails,
> `yt-dlp` tries; if both fail, `faster-whisper` downloads the audio and
> transcribes locally. Worst case: latency goes up, but the request
> still completes.

---

## 11. What I'd Build Next (the "what's next?" question)

1. **Streaming responses** — wire `astream_log` through FastAPI so the
   frontend renders token-by-token. UX win.
2. **Cross-encoder re-ranker** — `bge-reranker-base` on top-20
   retrieved. Expected hit@1 lift from 75% to 90%+.
3. **Persistent vector store with ingest worker** — make repeat visits
   to the same video instant.
4. **Held-out test set** — 20 more labeled pairs, never seen during
   tuning, for honest generalisation numbers.
5. **LLM-as-judge faithfulness** — automated hallucination detection on
   generated answers.
6. **Multi-query retrieval** — ask the LLM to rephrase the question 3
   ways, retrieve for each, dedupe and union. Handles paraphrase gaps.

---

## 12. Things to Have Ready In Front Of Me During Interview

- This document open in a tab.
- `rag/eval/BENCHMARKS.md` open — has the numbers in table form.
- `rag/eval/results_retrieval.json` — has the per-query breakdown so I
  can name which queries failed and why.
- `rag/chain.py` open — the LCEL chain is the most-asked-about file.
- `rag/config.py` open — every defended number lives there.

That's enough. Anything beyond this is "let me reason about it" and I
can do that on my feet.
