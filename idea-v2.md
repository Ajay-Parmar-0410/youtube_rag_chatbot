# YouTube RAG - Project Specification

This file defines the project scope, architecture, and tech stack for a YouTube Question-Answer bot powered by RAG (Retrieval-Augmented Generation). Designed to become the project's CLAUDE.md.

## Project Overview

A web application where users can paste a YouTube video URL, watch the video inline, and interact with its content through AI-powered features -- all built on a zero-cost tech stack.

## Core Features

### 1. Video Summary
- Generate concise summaries of YouTube video content
- Multiple summary lengths (brief, detailed)

### 2. Smart Notes
- AI-assisted note-taking while watching the video
- Timestamp-linked notes synced to video playback
- Export notes as markdown

### 3. Question & Answer
- Ask questions about the video content using RAG
- Context-aware answers grounded in the video transcript
- Follow-up question support with conversation history

### 4. Embedded Video Player
- YouTube video embedded on the page for reference while using features
- User pastes a URL and the video loads inline

### 5. Recommended Features
- **Flashcard generation** -- auto-generate flashcards from video content for revision
- **Key topics extraction** -- list main topics/concepts covered in the video
- **Transcript viewer** -- show full searchable transcript alongside the video
- **Chat history** -- persist past Q&A sessions per video
- **Share notes** -- generate a shareable link for notes (public read-only)
- **Multi-language support** -- translate summaries/answers to user's language

## Authentication & Multi-User

- Anyone can use summary, Q&A, and notes features **without login**
- **Login required** to save/persist notes, chat history, and flashcards
- Multi-user support with isolated user data
- Auth provider: Supabase Auth (free tier -- email/password + OAuth)

## Tech Stack (Zero-Cost)

### Frontend
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (free tier)

### Backend
- **API**: Next.js API Routes (serverless)
- **RAG Framework**: LangChain + LangGraph (Python)
- **Transcript extraction**: `youtube-transcript-api` + LangChain `YoutubeLoader`

### LLM (Free / Open-Source)

Primary: **Groq** (free tier -- fast inference for open-source models)

| Model | Use Case | Why |
|-------|----------|-----|
| `llama-3.3-70b-versatile` | Q&A, summary, chat | Best free open-source model on Groq, strong reasoning |
| `llama-3.1-8b-instant` | Lightweight tasks, flashcards, topic extraction | Fast, low latency, good enough for simple generation |
| `gemma2-9b-it` | Fallback / alternative | Google's open model, solid for instruction-following |
| `mistral-saba-24b` | Multilingual support | Strong multilingual capabilities |

Fallback providers (if Groq rate-limited):
- **Google Gemini** (`gemini-2.0-flash`) -- free tier, 15 RPM / 1M tokens per day
- **HuggingFace Inference API** (`mistralai/Mistral-7B-Instruct-v0.3`) -- free tier, rate-limited

### Embeddings (Free / Open-Source)

| Model | Dimensions | Speed | Quality | Best For |
|-------|-----------|-------|---------|----------|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Very fast | Good | MVP, quick prototyping (used in existing code) |
| `sentence-transformers/all-mpnet-base-v2` | 768 | Medium | Better | Production upgrade, more accurate retrieval |
| `BAAI/bge-small-en-v1.5` | 384 | Very fast | Better | Best quality-to-speed ratio, recommended |
| `BAAI/bge-base-en-v1.5` | 768 | Medium | Best | Maximum retrieval quality |
| `nomic-ai/nomic-embed-text-v1.5` | 768 | Medium | Best | Long context support (8192 tokens) |

**Recommendation**: Start with `BAAI/bge-small-en-v1.5` (better than MiniLM at same speed). Upgrade to `nomic-embed-text-v1.5` if longer transcript chunks are needed.

All embedding models run locally via `HuggingFaceEmbeddings` -- completely free, no API key needed.

### Vector Store
- **Primary**: FAISS (in-memory, fast, no server needed -- used in existing code)
- **Production upgrade**: Supabase pgvector (free tier, persists across sessions)
- **Alternative**: ChromaDB (local, persistent, easy setup)

### Database & Storage
- **Database**: Supabase PostgreSQL (free tier -- 500 MB)
- **Auth**: Supabase Auth (free tier)

### Infrastructure
- **Frontend + API hosting**: Vercel (free tier)
- **Python backend**: Vercel serverless functions or Railway (free tier)
- **CI/CD**: GitHub Actions (free for public repos)

## File Structure

```
youtube-rag/
|-- app/                    # Next.js App Router pages
|   |-- page.tsx            # Home -- paste URL, watch video, interact
|   |-- auth/               # Login/signup pages
|   |-- dashboard/          # Saved notes, history (auth required)
|   |-- api/                # API routes
|       |-- summary/        # POST -- generate summary
|       |-- qa/             # POST -- ask question
|       |-- notes/          # CRUD -- user notes
|       |-- transcript/     # GET -- fetch transcript
|-- components/             # Reusable UI components
|   |-- VideoPlayer.tsx     # Embedded YouTube player
|   |-- ChatPanel.tsx       # Q&A chat interface
|   |-- NotesEditor.tsx     # Note-taking panel
|   |-- SummaryView.tsx     # Summary display
|-- lib/                    # Shared utilities
|   |-- supabase.ts         # Supabase client
|   |-- auth.ts             # Auth helpers
|-- rag/                    # Python RAG pipeline (LangChain + LangGraph)
|   |-- chain.py            # RAG chain definition
|   |-- graph.py            # LangGraph workflow
|   |-- embeddings.py       # Embedding generation
|   |-- transcript.py       # YouTube transcript fetcher
|   |-- vectorstore.py      # Vector store operations
|-- types/                  # TypeScript type definitions
|-- public/                 # Static assets
```

## RAG Pipeline (LangChain + LangGraph)

### Flow
1. User pastes YouTube URL
2. Extract transcript via `YoutubeLoader` / `youtube-transcript-api`
3. Chunk transcript with `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200)
4. Generate embeddings via `HuggingFaceEmbeddings` and store in FAISS
5. Retrieve top-k relevant chunks (k=4, similarity search) via retriever
6. Augment prompt with retrieved context + user question
7. Generate answer via LLM (Groq ChatModel)
8. LangGraph manages workflow state (retrieval -> relevance grading -> generation -> hallucination check)

### Chain Architecture (from existing code)

```python
# Proven pattern from existing implementation
parallel_chain = RunnableParallel({
    "context": retriever | RunnableLambda(format_docs),
    "question": RunnablePassthrough()
})
main_chain = parallel_chain | prompt | model | StrOutputParser()
```

### Prompt Template

```
You are a helpful assistant.
Answer ONLY from the provided transcript context.
If the context is insufficient, just say you don't know.

Context: {context}
Question: {question}
```

### Existing Code Reference
- Prior LangChain notebook: `C:\Users\Dell\Downloads\Youtube_Chatbot`
- Working features to port: transcript loading, text splitting, FAISS indexing, retriever, RunnableParallel chain
- Upgrade path: replace HuggingFace Inference LLM with Groq ChatModel for faster responses

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM (pick one or both as fallback)
GROQ_API_KEY=            # Primary -- Groq free tier (Llama 3.3, Gemma 2)
GOOGLE_API_KEY=          # Fallback -- Gemini free tier

# Embeddings run locally (no API key needed for HuggingFace sentence-transformers)
# Optional: only if using HuggingFace Inference API as LLM fallback
HUGGINGFACE_API_KEY=
```

> **Security note**: Never commit API keys to git. The existing notebook had exposed HuggingFace tokens -- rotate those immediately.

## Key Patterns

### API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### Error Handling

- Validate all user inputs (URL format, query length)
- Graceful fallback when transcript is unavailable
- Rate limit API routes to stay within free-tier limits
- User-friendly error messages in the UI

## Verification & Testing Orchestration

Every change and phase completion MUST pass through a self-verification system before moving forward. This mirrors how a professional web developer would test -- automated, layered, and independent.

### Architecture: Parent Orchestrator + Sub-Agents

```
┌─────────────────────────────────────────────────────┐
│              VERIFICATION ORCHESTRATOR               │
│         (Parent Agent -- runs after every change)    │
│                                                      │
│  Decides what to verify based on what changed:       │
│  - Frontend file changed? → trigger frontend agent   │
│  - API route changed? → trigger backend agent        │
│  - Schema/migration changed? → trigger DB agent      │
│  - Phase completed? → trigger ALL agents             │
│                                                      │
│  Collects results, generates verdict: PASS / FAIL    │
│  If FAIL → blocks progress, reports what broke       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ FRONTEND │  │ BACKEND  │  │ DATABASE │          │
│  │ VERIFIER │  │ VERIFIER │  │ VERIFIER │          │
│  │(sub-agent)│ │(sub-agent)│ │(sub-agent)│          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ SECURITY │  │   E2E    │  │  BUILD   │          │
│  │ REVIEWER │  │  RUNNER  │  │  FIXER   │          │
│  │(sub-agent)│ │(sub-agent)│ │(sub-agent)│          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

### Sub-Agent Responsibilities

#### 1. Frontend Verifier
- **Agent**: `code-reviewer` + `tdd-guide`
- **Checks**:
  - Components render without errors (`npm run build`)
  - TypeScript types pass (`tsc --noEmit`)
  - Unit tests pass for components (Vitest/Jest)
  - No console errors in browser (E2E smoke test)
  - UI matches expected behavior (visual regression)
  - Accessibility basics (aria labels, keyboard nav)
- **Trigger**: Any file in `app/`, `components/`, `lib/` changes

#### 2. Backend Verifier
- **Agent**: `code-reviewer` + `tdd-guide`
- **Checks**:
  - API routes return correct status codes and response shapes
  - RAG pipeline returns grounded answers (not hallucinated)
  - Transcript extraction works for various YouTube URLs
  - Error handling: invalid URLs, missing transcripts, rate limits
  - Input validation: malformed requests rejected with proper errors
  - Python tests pass (`pytest` for `rag/` directory)
- **Trigger**: Any file in `app/api/`, `rag/` changes

#### 3. Database Verifier
- **Agent**: `code-reviewer`
- **Checks**:
  - Migrations run cleanly (up and down)
  - Queries return expected data shapes
  - Row-level security (RLS) policies enforce user isolation
  - Auth flows: signup, login, token refresh, logout
  - Data persistence: saved notes/history survive page reload
  - No orphaned data after deletions
- **Trigger**: Any Supabase schema, migration, or auth-related file changes

#### 4. Security Reviewer
- **Agent**: `security-reviewer`
- **Checks**:
  - No hardcoded secrets in code or git history
  - All user inputs sanitized (XSS, injection)
  - API routes validate auth tokens before accessing user data
  - CORS configured correctly
  - Rate limiting active on all public endpoints
  - Environment variables present at startup
- **Trigger**: Any API route, auth, or env-related file changes

#### 5. E2E Runner
- **Agent**: `e2e-runner` (Playwright)
- **Checks**:
  - Critical user journeys work end-to-end:
    1. Paste URL → video loads → transcript extracted
    2. Ask question → RAG returns grounded answer
    3. Generate summary → summary displays
    4. Create notes → notes save (with auth)
    5. Login → dashboard shows saved data
  - Cross-browser: Chrome + Firefox (minimum)
  - Artifacts captured: screenshots on failure, traces for debugging
- **Trigger**: Phase completion or major feature merge

#### 6. Build Fixer
- **Agent**: `build-error-resolver`
- **Role**: Not a verifier -- this agent activates only when another verifier reports a build/type failure
- **Behavior**: Fixes errors incrementally with minimal diffs, re-runs verification after each fix
- **Guardrail**: Stops if same error persists 3 times (escalates to user)

### Verification Triggers

| Event | What Runs | Mode |
|-------|-----------|------|
| Single file saved | Relevant sub-agent only | Quick |
| Feature branch complete | All sub-agents in parallel | Full |
| Phase milestone reached | All sub-agents + E2E suite | Full + E2E |
| Pre-commit | Build + types + lint + security | Pre-commit |
| Pre-PR | Everything + E2E + security scan | Pre-PR |

### Orchestrator Workflow

```
1. DETECT what changed (git diff)
   │
2. ROUTE to relevant sub-agents (run in parallel)
   │
   ├── Frontend Verifier ──→ PASS/FAIL + details
   ├── Backend Verifier  ──→ PASS/FAIL + details
   ├── Database Verifier ──→ PASS/FAIL + details
   └── Security Reviewer ──→ PASS/FAIL + details
   │
3. COLLECT results from all sub-agents
   │
4. VERDICT
   ├── ALL PASS → proceed to next task
   ├── ANY FAIL →
   │     ├── Build error? → dispatch Build Fixer → re-verify
   │     ├── Test failure? → report failing test + context → fix → re-verify
   │     └── Security issue? → STOP immediately → fix before anything else
   │
5. REPORT summary to user
   │
6. Phase complete? → run full E2E suite as final gate
```

### How to Invoke

```
/verify              # Full verification (all sub-agents)
/verify quick        # Build + types only (fast feedback)
/verify pre-commit   # Pre-commit checks
/verify pre-pr       # Everything + E2E + security
/tdd                 # TDD workflow with built-in verification
/e2e                 # E2E test suite for critical flows
/code-review         # Code quality + security review
/build-fix           # Fix build errors incrementally
```

### Test Coverage Targets

| Layer | Tool | Target | What |
|-------|------|--------|------|
| Unit tests | Vitest (frontend), pytest (Python) | 80%+ | Components, utilities, RAG functions |
| Integration tests | Vitest + Supertest, pytest | 80%+ | API routes, RAG chain end-to-end |
| E2E tests | Playwright | Critical flows | 5 core user journeys (see E2E Runner above) |
| Security scan | security-reviewer agent | Zero CRITICAL | OWASP Top 10, secrets, auth |
| Type check | `tsc --noEmit` | Zero errors | Full TypeScript coverage |
| Lint | ESLint (TS), Ruff (Python) | Zero errors | Code style consistency |

## Available Commands

- `/plan` - Create implementation plan for a feature
- `/tdd` - Test-driven development workflow (write tests first)
- `/code-review` - Review code quality + security
- `/build-fix` - Fix build errors incrementally
- `/verify` - Run full verification orchestrator
- `/e2e` - Run E2E test suite for critical user flows

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Branch per feature
- PRs require passing tests before merge

## Development Phases

Each phase ends with a **verification gate** -- the orchestrator runs all relevant sub-agents and the phase is not considered complete until all checks pass.

### Phase 1 - MVP
- Transcript extraction + embedded video player
- Basic Q&A with RAG pipeline
- Simple summary generation
- No auth required
- **Verification gate**:
  - Frontend: video player renders, URL input works
  - Backend: transcript API returns data, Q&A returns grounded answer
  - Build: `npm run build` passes, `tsc --noEmit` clean, `pytest` passes
  - E2E: paste URL → video loads → ask question → get answer

### Phase 2 - User Accounts
- Supabase Auth integration
- Save notes and chat history
- User dashboard
- **Verification gate**:
  - Database: migrations run, RLS policies enforce user isolation
  - Backend: auth endpoints work (signup, login, logout, refresh)
  - Frontend: login/signup forms work, dashboard renders saved data
  - Security: no token leaks, auth required on protected routes
  - E2E: signup → login → save notes → logout → login → notes persist

### Phase 3 - Enhanced Features
- Flashcard generation
- Key topics extraction
- Transcript viewer with search
- Share notes via link
- **Verification gate**:
  - Backend: flashcard/topics APIs return correct data
  - Frontend: all new UI panels render, search works in transcript
  - Security: shared links respect read-only, no auth bypass
  - E2E: generate flashcards → view topics → search transcript → share link

### Phase 4 - Polish
- Multi-language support
- Mobile responsive design
- Performance optimization
- **Verification gate (final)**:
  - Full E2E suite across all 5 critical journeys
  - Cross-browser: Chrome + Firefox
  - Mobile viewport tests
  - Performance: Lighthouse score check
  - Security: full scan, zero CRITICAL/HIGH issues
  - Coverage: 80%+ unit + integration across frontend and backend
