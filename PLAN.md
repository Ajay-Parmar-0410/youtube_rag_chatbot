I now have all the context needed. The project directory currently only contains the `everything-claude-code` cloned repo and the spec files -- no actual source code has been written yet. Here is the comprehensive implementation plan.

---

# Implementation Plan: YouTube RAG Web Application

## Overview

A zero-cost web application where users paste a YouTube URL, watch the video inline, and interact with its content through AI-powered Q&A, summaries, notes, flashcards, and more. The frontend is Next.js + Tailwind on Vercel; the backend is a Python FastAPI service running the RAG pipeline (LangChain + LangGraph, FAISS, Groq LLM, BGE embeddings) hosted on Railway. All external accounts (Supabase, Groq, Vercel) are created at the very end -- development uses placeholder environment variables and local services throughout.

## Requirements

- Zero-cost stack: all services on free tiers
- Works without login for core features (summary, Q&A, video player)
- Login required only for persistence (notes, history, flashcards)
- RAG pipeline: YouTube transcript -> chunk -> embed (BGE-small) -> FAISS -> retrieve -> Groq LLM -> answer
- Four development phases, each with a verification gate
- Accounts and API keys configured as the final step

## Assumptions

- Node.js 18+ and Python 3.10+ are installed on the machine
- The existing Jupyter notebook at `C:\Users\Dell\Downloads\Youtube_Chatbot` contains a working LangChain pipeline with `YoutubeLoader`, `RecursiveCharacterTextSplitter`, FAISS, `RunnableParallel`, and HuggingFace Inference API (Mistral-7B) -- to be ported and upgraded to Groq
- The `C:\Users\Dell\Desktop\youtube-rag\everything-claude-code` directory is a reference clone, not the project root
- All project source code will live directly under `C:\Users\Dell\Desktop\youtube-rag/`

## Architecture

```
Browser (Next.js on Vercel)
    |
    |-- Next.js API Routes (/api/transcript, /api/summary, /api/qa, /api/notes)
    |       |
    |       |-- Proxy calls to Python RAG service
    |       |-- Direct Supabase calls for auth/CRUD
    |
Python FastAPI service (Railway free tier)
    |-- /transcript  (youtube-transcript-api)
    |-- /qa          (RAG chain: retrieve + Groq LLM)
    |-- /summary     (full transcript + Groq LLM)
    |-- /flashcards  (Phase 3)
    |-- /topics      (Phase 3)
    |
    Uses: FAISS (in-memory), HuggingFaceEmbeddings (local), Groq ChatModel
```

---

## Implementation Steps

### PHASE 1: MVP (No Auth)

**Goal**: Paste a YouTube URL, see the video, get a summary, and ask questions via RAG.

---

#### Step 1.1: Initialize Git Repository

- **Files**: `C:\Users\Dell\Desktop\youtube-rag/.gitignore`, `C:\Users\Dell\Desktop\youtube-rag/.git/`
- **Action**: Run `git init` in the project root. Create `.gitignore` with entries for `node_modules/`, `.next/`, `__pycache__/`, `.env*`, `*.pyc`, `venv/`, `.faiss_store/`, `.pytest_cache/`
- **Dependencies**: None
- **Risk**: Low
- **Test**: `git status` returns clean repo

#### Step 1.2: Scaffold Next.js Frontend

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/package.json`
  - `C:\Users\Dell\Desktop\youtube-rag/tsconfig.json`
  - `C:\Users\Dell\Desktop\youtube-rag/next.config.ts`
  - `C:\Users\Dell\Desktop\youtube-rag/tailwind.config.ts`
  - `C:\Users\Dell\Desktop\youtube-rag/postcss.config.mjs`
  - `C:\Users\Dell\Desktop\youtube-rag/app/layout.tsx`
  - `C:\Users\Dell\Desktop\youtube-rag/app/page.tsx`
  - `C:\Users\Dell\Desktop\youtube-rag/app/globals.css`
- **Action**: Run `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"` from the project root. This scaffolds the App Router project with Tailwind CSS. Add additional dev dependencies: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react playwright @playwright/test`
- **Dependencies**: Step 1.1
- **Risk**: Low
- **Test**: `npm run dev` starts on localhost:3000, shows default Next.js page

#### Step 1.3: Configure Vitest and Playwright

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/vitest.config.ts` -- configure jsdom environment, path aliases, coverage thresholds (80%)
  - `C:\Users\Dell\Desktop\youtube-rag/playwright.config.ts` -- configure base URL, browsers (chromium, firefox), screenshot on failure
  - `C:\Users\Dell\Desktop\youtube-rag/tests/setup.ts` -- Vitest setup with testing-library matchers
- **Action**: Configure both test runners. Add scripts to `package.json`: `"test": "vitest"`, `"test:e2e": "playwright test"`, `"test:coverage": "vitest --coverage"`
- **Dependencies**: Step 1.2
- **Risk**: Low
- **Test**: `npm test -- --run` exits cleanly (no tests yet, no failures)

#### Step 1.4: Create TypeScript Types

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/types/api.ts` -- `ApiResponse<T>`, `TranscriptSegment`, `QARequest`, `QAResponse`, `SummaryRequest`, `SummaryResponse`, `VideoMetadata`
  - `C:\Users\Dell\Desktop\youtube-rag/types/chat.ts` -- `ChatMessage`, `ChatSession`, `MessageRole`
- **Action**: Define all shared TypeScript interfaces. The `ApiResponse<T>` envelope is:
  ```typescript
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }
  ```
- **Dependencies**: Step 1.2
- **Risk**: Low
- **Test**: `npx tsc --noEmit` passes

#### Step 1.5: Create Environment Variable Template

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/.env.local` -- placeholder values, never committed
  - `C:\Users\Dell\Desktop\youtube-rag/.env.example` -- committed template with empty values
- **Action**: Define all env vars with placeholder values for local development:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=http://placeholder-will-be-replaced
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-will-be-replaced
  SUPABASE_SERVICE_ROLE_KEY=placeholder-will-be-replaced
  GROQ_API_KEY=placeholder-will-be-replaced
  GOOGLE_API_KEY=placeholder-will-be-replaced
  RAG_SERVICE_URL=http://localhost:8000
  ```
  The Python service reads `GROQ_API_KEY` from its own `.env`. During Phase 1, the Supabase keys are unused. The `RAG_SERVICE_URL` points to the local FastAPI server.
- **Dependencies**: Step 1.2
- **Risk**: Low -- placeholders allow builds to succeed without real keys
- **Test**: `.env.example` is committed; `.env.local` is gitignored

#### Step 1.6: Create Utility Library

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/lib/constants.ts` -- YouTube URL regex, API endpoints, chunk sizes, model names
  - `C:\Users\Dell\Desktop\youtube-rag/lib/validation.ts` -- `validateYouTubeUrl(url: string): { valid: boolean; videoId?: string; error?: string }`, `validateQuery(query: string): { valid: boolean; error?: string }`
  - `C:\Users\Dell\Desktop\youtube-rag/lib/youtube.ts` -- `extractVideoId(url: string): string | null`, `getEmbedUrl(videoId: string): string`
- **Action**: Implement pure utility functions. The YouTube URL validator should handle all formats: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, with or without timestamps and playlists.
- **Dependencies**: Step 1.4
- **Risk**: Low
- **Test**: Write unit tests first (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/lib/validation.test.ts` -- test valid/invalid URLs, edge cases (empty string, non-YouTube URLs, URLs with extra params)
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/lib/youtube.test.ts` -- test video ID extraction for all URL formats

#### Step 1.7: Scaffold Python RAG Service

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/requirements.txt` -- `fastapi`, `uvicorn[standard]`, `langchain`, `langchain-community`, `langchain-groq`, `langchain-huggingface`, `faiss-cpu`, `youtube-transcript-api`, `python-dotenv`, `pydantic`, `pytest`, `ruff`, `httpx`
  - `C:\Users\Dell\Desktop\youtube-rag/rag/.env` -- `GROQ_API_KEY=placeholder-will-be-replaced` (gitignored)
  - `C:\Users\Dell\Desktop\youtube-rag/rag/.env.example` -- committed template
  - `C:\Users\Dell\Desktop\youtube-rag/rag/main.py` -- FastAPI app with CORS, health check endpoint (`GET /health`)
  - `C:\Users\Dell\Desktop\youtube-rag/rag/config.py` -- `Settings` pydantic model loading env vars, model names, chunk sizes
  - `C:\Users\Dell\Desktop\youtube-rag/rag/models.py` -- Pydantic request/response models: `TranscriptRequest`, `TranscriptResponse`, `QARequest`, `QAResponse`, `SummaryRequest`, `SummaryResponse`
- **Action**: Create a Python virtual environment (`python -m venv rag/venv`), install requirements. Set up FastAPI with `/health` returning `{"status": "ok"}`. Configure CORS to allow `http://localhost:3000`.
- **Dependencies**: Step 1.1
- **Risk**: Low
- **Test**: `cd rag && python -m uvicorn main:app --reload` starts on port 8000; `curl http://localhost:8000/health` returns `{"status":"ok"}`

#### Step 1.8: Implement Transcript Extraction (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/transcript.py` -- `async def fetch_transcript(video_id: str) -> list[TranscriptSegment]` using `youtube-transcript-api`. Returns list of `{text, start, duration}`. Handles errors: no transcript available, video not found, auto-generated vs manual captions. Falls back to auto-generated if manual unavailable.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/transcript.py` -- FastAPI router with `POST /transcript` endpoint accepting `{"video_id": "..."}`, returning `ApiResponse` envelope.
- **Action**: Port the transcript loading logic from the existing notebook (which uses `YoutubeLoader`). Prefer `youtube-transcript-api` directly for more control over language selection and error handling. Register the router in `main.py`.
- **Dependencies**: Step 1.7
- **Risk**: Medium -- `youtube-transcript-api` can break if YouTube changes its API. Mitigation: wrap in try/except with clear error messages; add fallback to `YoutubeLoader` from langchain-community.
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_transcript.py` -- test with a known video ID (e.g., `dQw4w9WgXcQ`), test error handling for invalid IDs, test that segments have required fields

#### Step 1.9: Implement Embedding and Vector Store (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/embeddings.py` -- Initialize `HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")`. Singleton pattern so the model is loaded once. Function: `get_embeddings() -> HuggingFaceEmbeddings`
  - `C:\Users\Dell\Desktop\youtube-rag/rag/vectorstore.py` -- Functions: `create_vectorstore(documents: list[Document]) -> FAISS`, `get_retriever(vectorstore: FAISS, k: int = 4) -> VectorStoreRetriever`. Uses `RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)` to chunk the transcript before indexing.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/store_manager.py` -- In-memory dict mapping `video_id -> FAISS` instance. Functions: `get_or_create_store(video_id, transcript_text) -> FAISS`, `has_store(video_id) -> bool`. This avoids re-embedding the same video on every question.
- **Action**: Port from existing notebook. The notebook uses `all-MiniLM-L6-v2`; upgrade to `BAAI/bge-small-en-v1.5` per spec. The first call will download the model (~130MB) to local cache.
- **Dependencies**: Step 1.7
- **Risk**: Medium -- first model download takes time; embedding on serverless may be slow. Mitigation: local development uses persistent cache; for Railway, the model is cached in the Docker layer.
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_vectorstore.py` -- test chunking produces expected number of docs for a known transcript length, test retriever returns k results, test store_manager caches correctly

#### Step 1.10: Implement RAG Chain (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/chain.py` -- The core RAG chain using LangChain LCEL:
    ```python
    # Pattern from existing notebook + spec
    parallel_chain = RunnableParallel({
        "context": retriever | RunnableLambda(format_docs),
        "question": RunnablePassthrough()
    })
    main_chain = parallel_chain | prompt | model | StrOutputParser()
    ```
    Functions: `create_qa_chain(retriever) -> Runnable`, `create_summary_chain() -> Runnable`. Uses `ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.3)`. Includes the prompt template from the spec.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/prompts.py` -- Prompt templates as constants: `QA_PROMPT` (grounded Q&A), `SUMMARY_BRIEF_PROMPT`, `SUMMARY_DETAILED_PROMPT`. Each template instructs the LLM to answer only from provided context.
- **Action**: Port from notebook's `RunnableParallel` pattern. Replace `HuggingFaceEndpoint` (Mistral-7B) with `ChatGroq` (llama-3.3-70b). The chain is stateless -- a new chain is built per request using the video's retriever.
- **Dependencies**: Steps 1.8, 1.9
- **Risk**: High -- Groq API key required for actual inference. Mitigation: during development without a key, the chain creation works but invocation will fail with a clear error message. Tests mock the LLM call.
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_chain.py` -- test chain construction (no API call), test `format_docs` utility, test prompt templates contain expected placeholders. Mock `ChatGroq` for integration tests.

#### Step 1.11: Implement Q&A and Summary API Routes (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/qa.py` -- `POST /qa` accepting `{"video_id": "...", "question": "...", "chat_history": [...]}`. Validates inputs, gets or creates vector store for the video, builds chain, invokes, returns answer in `ApiResponse` envelope.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/summary.py` -- `POST /summary` accepting `{"video_id": "...", "mode": "brief"|"detailed"}`. Fetches full transcript, sends to LLM with summary prompt. For brief: max 200 words. For detailed: structured with sections.
- **Action**: Register both routers in `main.py`. Add input validation (video_id format, question length 1-1000 chars, mode enum). Add error handling for transcript fetch failures, LLM timeouts, rate limits.
- **Dependencies**: Steps 1.8, 1.9, 1.10
- **Risk**: Medium -- rate limits on Groq free tier (30 RPM). Mitigation: add retry with exponential backoff; return clear error to frontend when rate-limited.
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_routes_qa.py` -- test input validation (reject empty question, reject invalid video_id), test successful response shape (mocked LLM)
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_routes_summary.py` -- test both summary modes, test error handling

#### Step 1.12: Build VideoPlayer Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/VideoPlayer.tsx` -- Embeds YouTube video using `<iframe>` with the video ID. Props: `videoId: string`. Uses `youtube.com/embed/{videoId}` URL. Responsive 16:9 aspect ratio container. Shows placeholder state when no video loaded.
- **Action**: Build a simple, responsive embed. No external YouTube player library needed -- plain iframe is sufficient for MVP. Add `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"` and `allowfullscreen`.
- **Dependencies**: Step 1.6
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/VideoPlayer.test.tsx` -- renders iframe with correct src, shows placeholder when no videoId, responsive container has correct aspect ratio

#### Step 1.13: Build URL Input Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/UrlInput.tsx` -- Input field + "Load" button. Validates URL on submit using `validateYouTubeUrl`. Shows inline error for invalid URLs. Calls `onSubmit(videoId)` callback when valid. Debounced paste detection for auto-submit UX.
- **Dependencies**: Step 1.6
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/UrlInput.test.tsx` -- shows error for invalid URL, calls onSubmit with extracted videoId for valid URL, button disabled while loading

#### Step 1.14: Build SummaryView Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/SummaryView.tsx` -- Displays summary with toggle between brief/detailed. Shows loading skeleton while fetching. Props: `videoId: string`. Fetches from Next.js API route on mount/videoId change. Renders markdown content.
- **Dependencies**: Step 1.4
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/SummaryView.test.tsx` -- shows loading state, renders summary text, toggles between brief/detailed, shows error state

#### Step 1.15: Build ChatPanel Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/ChatPanel.tsx` -- Chat interface with message list and input. Manages local conversation history as immutable array. Each message has `role` (user/assistant) and `content`. Sends question + history to Next.js API route. Shows typing indicator while waiting. Auto-scrolls to latest message.
  - `C:\Users\Dell\Desktop\youtube-rag/components/ChatMessage.tsx` -- Single message bubble. Different styling for user vs assistant. Renders markdown in assistant messages.
- **Dependencies**: Step 1.4
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/ChatPanel.test.tsx` -- sends message on submit, displays user and assistant messages, shows loading indicator, maintains conversation history immutably

#### Step 1.16: Build Next.js API Proxy Routes

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/transcript/route.ts` -- `POST` handler. Validates request body, forwards to Python service `RAG_SERVICE_URL/transcript`, returns response in `ApiResponse` envelope.
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/qa/route.ts` -- `POST` handler. Validates `videoId` and `question`, forwards to Python `/qa`, returns `ApiResponse`.
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/summary/route.ts` -- `POST` handler. Validates `videoId` and `mode`, forwards to Python `/summary`, returns `ApiResponse`.
  - `C:\Users\Dell\Desktop\youtube-rag/lib/rag-client.ts` -- Shared fetch wrapper for calling the Python service. Handles timeouts (30s for Q&A, 60s for summary), retries, error normalization.
- **Action**: These are thin proxy routes that validate input, call the Python service, and normalize the response. This keeps the Python service URL private (not exposed to the browser).
- **Dependencies**: Steps 1.5, 1.6
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/transcript.test.ts` -- test input validation, test error forwarding
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/qa.test.ts` -- test validates question length, test timeout handling

#### Step 1.17: Build Home Page

- **Files created/modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/page.tsx` -- Main page layout. State: `videoId`, `isLoading`. Layout: URL input at top, then a two-column grid -- left column has VideoPlayer + SummaryView, right column has ChatPanel. Mobile: stacks vertically. Uses React state to pass `videoId` to child components.
  - `C:\Users\Dell\Desktop\youtube-rag/app/layout.tsx` -- (modify) Add app title "YouTube RAG", dark/light theme support via Tailwind `dark:` classes, global font setup.
- **Dependencies**: Steps 1.12, 1.13, 1.14, 1.15, 1.16
- **Risk**: Low
- **Test**: Manual verification: paste a YouTube URL, video loads, summary appears, can ask questions. Automated E2E test comes next.

#### Step 1.18: Add NotesEditor Component (Basic)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/NotesEditor.tsx` -- Simple textarea-based editor for taking notes while watching. Local state only (no persistence yet -- that is Phase 2). Props: `videoId: string`. Features: basic markdown editing, export as `.md` file download. Timestamp insert button that captures current video time.
- **Dependencies**: Step 1.12
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/NotesEditor.test.tsx` -- text input works, export downloads file, timestamp button inserts formatted timestamp

#### Step 1.19: Python Test Suite and Linting

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/pytest.ini` -- configure test discovery, markers
  - `C:\Users\Dell\Desktop\youtube-rag/rag/ruff.toml` -- Ruff linter config (line length 100, Python 3.10 target)
  - `C:\Users\Dell\Desktop\youtube-rag/rag/conftest.py` -- shared fixtures (mock Groq client, sample transcript data, sample embeddings)
- **Action**: Ensure all Python tests from steps 1.8-1.11 pass. Run `ruff check rag/` for linting.
- **Dependencies**: Steps 1.8-1.11
- **Risk**: Low
- **Test**: `cd rag && pytest -v` all green; `ruff check .` no errors

#### Step 1.20: Phase 1 E2E Test

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/mvp.spec.ts` -- Playwright test for the critical MVP journey:
    1. Navigate to home page
    2. Paste a YouTube URL
    3. Verify video player loads with correct embed
    4. Verify summary appears (mock the Python service response)
    5. Type a question in chat, verify answer appears
    6. Verify notes editor is present and functional
- **Dependencies**: Step 1.17
- **Risk**: Medium -- E2E tests are brittle with real API calls. Mitigation: mock the Python service at the network level using Playwright's `route.fulfill()`.
- **Test**: `npm run test:e2e` passes


#### Step 1.21: Phase 1 Verification Gate

- **Action**: Run the full verification orchestrator for Phase 1:
  - `npm run build` -- must pass (zero TypeScript errors)
  - `npx tsc --noEmit` -- must pass
  - `npm test -- --run` -- all Vitest unit tests pass
  - `cd rag && pytest -v` -- all Python tests pass
  -/ `cd rag && ruff check .` -- no lint errors
  - `npm run test:e2e` -- Playwright MVP journey passes
  - Security check: no hardcoded secrets in git history
- **Dependencies**: All Phase 1 steps (1.1-1.20)
- **Risk**: Low -- all individual steps have been tested
- **Pass criteria**: ALL checks green. No auth or database checks needed for Phase 1.

---

### PHASE 2: User Accounts

**Goal**: Add Supabase Auth, persist notes and chat history, build user dashboard.

---

#### Step 2.1: Define Supabase Schema (SQL Migrations)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/001_initial_schema.sql` -- Create tables:
    ```sql
    -- users table is managed by Supabase Auth (auth.users)

    CREATE TABLE public.notes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      video_id TEXT NOT NULL,
      video_title TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE public.chat_sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      video_id TEXT NOT NULL,
      video_title TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE public.chat_messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
      role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS policies
    ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can CRUD own notes"
      ON public.notes FOR ALL
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can CRUD own chat sessions"
      ON public.chat_sessions FOR ALL
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can CRUD messages in own sessions"
      ON public.chat_messages FOR ALL
      USING (session_id IN (
        SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
      ));

    -- Indexes
    CREATE INDEX idx_notes_user_video ON public.notes(user_id, video_id);
    CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
    CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
    ```
- **Action**: Write the migration SQL. This will be applied to Supabase when the account is created (Step 5.1). During development, the schema serves as documentation.
- **Dependencies**: None (independent of Phase 1 code)
- **Risk**: Medium -- RLS policies must be correct to prevent data leakage. Mitigation: test with multiple user contexts.
- **Test**: SQL syntax is valid (can dry-run against a local PostgreSQL if available)



#### Step 2.2: Install Supabase Client Libraries

- **Action**: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/package.json` -- new dependencies added
- **Dependencies**: Step 1.2
- **Risk**: Low



#### Step 2.3: Create Supabase Client Utilities

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/lib/supabase.ts` -- Two clients:
    1. `createBrowserClient()` -- for client components, uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    2. `createServerClient(cookieStore)` -- for server components and API routes, uses service role key for admin operations
  - `C:\Users\Dell\Desktop\youtube-rag/lib/auth.ts` -- Helper functions: `getCurrentUser()`, `requireAuth()` (throws if not authenticated), `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `onAuthStateChange(callback)`
- **Dependencies**: Steps 2.2, 1.5
- **Risk**: Low -- with placeholder keys, these modules load but client calls will fail gracefully
- **Test**: Modules import without errors; `createBrowserClient()` returns a Supabase client instance (even with placeholder URL)

#### Step 2.4: Build Auth Pages

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/auth/login/page.tsx` -- Email + password login form. Redirects to home on success. Shows error for invalid credentials. Link to signup page.
  - `C:\Users\Dell\Desktop\youtube-rag/app/auth/signup/page.tsx` -- Email + password signup form. Shows success message ("check your email"). Link to login page.
  - `C:\Users\Dell\Desktop\youtube-rag/app/auth/callback/route.ts` -- OAuth callback handler (for future Google/GitHub OAuth). Exchanges code for session.
  - `C:\Users\Dell\Desktop\youtube-rag/components/AuthButton.tsx` -- Conditional render: shows "Login" button when logged out, shows user email + "Logout" when logged in. Used in the app header.
  - `C:\Users\Dell\Desktop\youtube-rag/components/AuthProvider.tsx` -- React context provider wrapping the app. Listens to `onAuthStateChange`, provides `user` and `isLoading` to children.
- **Action**: Build forms with Tailwind styling. Input validation: email format, password minimum 8 characters. All auth calls go through `lib/auth.ts`.
- **Dependencies**: Step 2.3
- **Risk**: Low -- forms work visually even without real Supabase connection
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/AuthButton.test.tsx` -- shows login when no user, shows email when user present
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/auth/login.test.tsx` -- validates email, validates password length, shows error state

#### Step 2.5: Integrate Auth into App Layout

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/layout.tsx` -- Wrap children with `<AuthProvider>`. Add header with `<AuthButton>` and navigation links (Home, Dashboard).
- **Dependencies**: Step 2.4
- **Risk**: Low
- **Test**: `npm run build` passes; header shows login button

#### Step 2.6: Create Notes API Routes (Next.js)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/route.ts` -- `GET` (list user's notes, requires auth), `POST` (create note, requires auth). Uses Supabase server client.
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/[id]/route.ts` -- `GET` (single note), `PUT` (update), `DELETE`. All require auth. RLS ensures user can only access own notes.
- **Action**: Each handler calls `requireAuth()` first. On failure, returns `401 ApiResponse`. On success, performs Supabase CRUD and returns data in `ApiResponse` envelope.
- **Dependencies**: Steps 2.3, 2.1
- **Risk**: Medium -- must ensure RLS works correctly
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/notes.test.ts` -- test 401 when no auth token, test CRUD response shapes (mock Supabase client)

#### Step 2.7: Create Chat History API Routes (Next.js)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/chat/sessions/route.ts` -- `GET` (list user's chat sessions), `POST` (create new session for a video). Requires auth.
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/chat/sessions/[id]/messages/route.ts` -- `GET` (list messages in session), `POST` (append message). Requires auth.
- **Dependencies**: Steps 2.3, 2.1
- **Risk**: Medium -- message ordering must use `created_at`
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/chat-sessions.test.ts` -- test auth requirement, test session creation, test message ordering

#### Step 2.8: Upgrade NotesEditor with Persistence

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/NotesEditor.tsx` -- Add "Save" button (visible only when logged in). On save, calls `POST /api/notes`. Load existing note for this video if one exists. Auto-save with debounce (2 seconds after last keystroke). Show "Saved" / "Saving..." / "Login to save" status.
- **Dependencies**: Steps 2.6, 2.4
- **Risk**: Low
- **Test**: Update existing unit test to cover save/load states

#### Step 2.9: Upgrade ChatPanel with History Persistence

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/ChatPanel.tsx` -- When user is logged in: create a chat session on first message, persist each message to `/api/chat/sessions/[id]/messages`. Load previous session for this video if one exists. Show "Login to save chat history" hint when not logged in.
- **Dependencies**: Steps 2.7, 2.4
- **Risk**: Medium -- must handle race conditions between send and persist
- **Test**: Update existing unit test to cover persistence states

#### Step 2.10: Build User Dashboard

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/dashboard/page.tsx` -- Protected page (redirects to login if not authenticated). Shows: list of saved notes (grouped by video), list of past chat sessions, quick links to resume watching. Uses server-side data fetching.
  - `C:\Users\Dell\Desktop\youtube-rag/components/NoteCard.tsx` -- Card component showing note preview: video title, first 100 chars, last updated date. Click navigates to home page with video loaded.
  - `C:\Users\Dell\Desktop\youtube-rag/components/SessionCard.tsx` -- Card component showing chat session preview: video title, message count, last active date.
- **Dependencies**: Steps 2.6, 2.7, 2.5
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/NoteCard.test.tsx` -- renders title, preview, date
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/dashboard.test.tsx` -- redirects when not authenticated, renders cards when data present

#### Step 2.11: Add Middleware for Protected Routes

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/middleware.ts` -- Next.js middleware that checks Supabase session for `/dashboard` routes. Redirects to `/auth/login` if no valid session. Allows all other routes through (core features work without auth).
- **Dependencies**: Step 2.3
- **Risk**: Low
- **Test**: Accessing `/dashboard` without login redirects to `/auth/login`

#### Step 2.12: Phase 2 E2E Test

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/auth.spec.ts` -- Playwright tests:
    1. Visit login page, submit invalid credentials, see error
    2. Visit signup page, create account (mocked Supabase)
    3. Login, navigate to dashboard, see empty state
    4. Load a video, save notes, verify they appear on dashboard
    5. Ask a question, verify chat history persists
    6. Logout, verify dashboard redirects to login
    7. Login again, verify saved data still present
- **Dependencies**: Steps 2.1-2.11
- **Risk**: Medium -- auth E2E tests need careful mocking
- **Test**: `npm run test:e2e` passes all auth specs

#### Step 2.13: Phase 2 Verification Gate

- **Action**: Run the full verification orchestrator for Phase 2:
  - All Phase 1 checks still pass (no regression)
  - Database: migration SQL is valid, RLS policies cover all tables
  - Backend: auth endpoints return correct shapes, protected routes reject unauthenticated requests
  - Frontend: login/signup forms render, dashboard renders saved data, auth state propagates correctly
  - Security: no token leaks in client-side code, auth required on all protected routes, no hardcoded secrets
  - E2E: full auth journey passes
- **Dependencies**: All Phase 2 steps
- **Pass criteria**: ALL checks green including Phase 1 regression tests.

---

### PHASE 3: Enhanced Features

**Goal**: Flashcards, key topics, transcript viewer with search, share notes.

---

#### Step 3.1: Implement Flashcard Generation (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/flashcards.py` -- `POST /flashcards` accepting `{"video_id": "...", "count": 10}`. Fetches full transcript, sends to LLM (`llama-3.1-8b-instant` for speed) with flashcard prompt, parses structured JSON output. Returns list of `{question, answer, difficulty}`.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/prompts.py` -- (modify) Add `FLASHCARD_PROMPT` template: instructs LLM to generate Q&A flashcards from transcript, output as JSON array.
- **Dependencies**: Steps 1.10, 1.8
- **Risk**: Medium -- LLM JSON output can be malformed. Mitigation: wrap in try/except, retry with stricter prompt if parse fails, validate against Pydantic model.
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_flashcards.py` -- test prompt contains expected placeholders, test response parsing with mock LLM output, test malformed JSON handling

#### Step 3.2: Implement Key Topics Extraction (Python)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/topics.py` -- `POST /topics` accepting `{"video_id": "..."}`. Extracts main topics/concepts using `llama-3.1-8b-instant`. Returns list of `{topic, description, timestamp_start}` where timestamp links to the relevant part of the video.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/prompts.py` -- (modify) Add `TOPICS_PROMPT` template.
- **Dependencies**: Steps 1.10, 1.8
- **Risk**: Low -- similar pattern to flashcards
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_topics.py` -- test response shape, test timestamp parsing

#### Step 3.3: Add Flashcards and Topics API Proxies (Next.js)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/flashcards/route.ts` -- `POST` proxy to Python `/flashcards`
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/topics/route.ts` -- `POST` proxy to Python `/topics`
- **Dependencies**: Steps 3.1, 3.2, 1.16
- **Risk**: Low
- **Test**: Same pattern as existing proxy routes

#### Step 3.4: Build Flashcard Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/FlashcardViewer.tsx` -- Flip-card UI. Shows question on front, answer on back. Click/tap to flip. Navigation: next/previous/shuffle. Progress indicator (3/10). Difficulty badge. Generate button fetches flashcards for current video.
  - `C:\Users\Dell\Desktop\youtube-rag/components/FlashCard.tsx` -- Single card with flip animation (CSS transform). Front shows question, back shows answer.
- **Dependencies**: Step 3.3
- **Risk**: Low
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/FlashcardViewer.test.tsx` -- renders question, flips on click, navigates between cards

#### Step 3.5: Build Key Topics Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/TopicsList.tsx` -- Vertical list of extracted topics. Each topic shows name, brief description, and clickable timestamp. Clicking timestamp seeks the embedded video to that point (communicates with VideoPlayer via callback).
- **Dependencies**: Step 3.3
- **Risk**: Low -- timestamp seeking requires YouTube iframe API postMessage
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/TopicsList.test.tsx` -- renders topic list, click triggers seek callback

#### Step 3.6: Build Transcript Viewer Component

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/TranscriptViewer.tsx` -- Full scrollable transcript with timestamps. Search input at top filters/highlights matching segments. Click on a segment seeks video to that timestamp. Current segment highlighted based on video playback position. Lazy loads for long transcripts (virtual scrolling).
- **Dependencies**: Steps 1.8, 1.16
- **Risk**: Medium -- performance with very long transcripts. Mitigation: use virtual scrolling (only render visible segments).
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/TranscriptViewer.test.tsx` -- renders segments, search filters correctly, click triggers seek

#### Step 3.7: Implement Share Notes Feature

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/002_shared_notes.sql` -- Add columns to `notes` table:
    ```sql
    ALTER TABLE public.notes ADD COLUMN share_id UUID UNIQUE;
    ALTER TABLE public.notes ADD COLUMN is_shared BOOLEAN DEFAULT false;

    -- Public read policy for shared notes
    CREATE POLICY "Anyone can read shared notes"
      ON public.notes FOR SELECT
      USING (is_shared = true);
    ```
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/[id]/share/route.ts` -- `POST` (generate share link, sets `is_shared=true` and generates `share_id`), `DELETE` (revoke share). Requires auth.
  - `C:\Users\Dell\Desktop\youtube-rag/app/shared/[shareId]/page.tsx` -- Public page that displays a shared note in read-only mode. No auth required. Shows video embed + note content.
- **Dependencies**: Steps 2.6, 2.1
- **Risk**: Medium -- must ensure shared notes are truly read-only and the share link cannot be used to modify data
- **Test** (TDD):
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/share.test.ts` -- test share generation, test revocation, test public access
  - `C:\Users\Dell\Desktop\youtube-rag/tests/unit/shared-page.test.tsx` -- renders shared note content, no edit controls visible

#### Step 3.8: Update Home Page with New Features

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/page.tsx` -- Add tabbed interface below the video: "Summary", "Q&A", "Notes", "Flashcards", "Topics", "Transcript". Each tab lazy-loads its component. Tab state persisted in URL query params.
- **Dependencies**: Steps 3.4, 3.5, 3.6, 1.14, 1.15, 1.18
- **Risk**: Low
- **Test**: All tabs render without errors; switching tabs preserves state

#### Step 3.9: Flashcard Persistence (Database)

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/003_flashcards.sql` -- Create table:
    ```sql
    CREATE TABLE public.flashcards (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      video_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can CRUD own flashcards"
      ON public.flashcards FOR ALL USING (auth.uid() = user_id);
    ```
  - `C:\Users\Dell\Desktop\youtube-rag/app/api/flashcards/save/route.ts` -- `POST` (save generated flashcards for logged-in user), `GET` (retrieve saved flashcards for a video). Requires auth.
- **Dependencies**: Steps 3.1, 2.3
- **Risk**: Low
- **Test**: Flashcards save and load correctly for authenticated users

#### Step 3.10: Phase 3 E2E Test

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/enhanced.spec.ts` -- Playwright tests:
    1. Load video, switch to Flashcards tab, generate flashcards, flip through them
    2. Switch to Topics tab, see topic list, click timestamp
    3. Switch to Transcript tab, search for a term, click segment
    4. Save a note, share it, open share link in incognito, verify read-only view
- **Dependencies**: Steps 3.1-3.9
- **Risk**: Medium
- **Test**: `npm run test:e2e` passes all enhanced specs

#### Step 3.11: Phase 3 Verification Gate

- **Action**: Full verification:
  - All Phase 1 + Phase 2 checks still pass
  - Backend: flashcard and topics APIs return correctly shaped data
  - Frontend: all new tabs render, transcript search works, flashcard flip animation works
  - Security: shared links are read-only, no auth bypass on share endpoints
  - E2E: enhanced feature journey passes
- **Pass criteria**: ALL checks green including Phase 1 + 2 regression.

---

### PHASE 4: Polish

**Goal**: Multi-language, mobile responsive, performance, final quality.

---

#### Step 4.1: Multi-Language Summary and Q&A

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/prompts.py` -- Add `MULTILINGUAL_QA_PROMPT` and `MULTILINGUAL_SUMMARY_PROMPT` that include `{language}` parameter. When language is specified, the LLM responds in that language.
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/qa.py` -- Accept optional `language` field in request body. Use `mistral-saba-24b` model when non-English language requested (strong multilingual capabilities).
  - `C:\Users\Dell\Desktop\youtube-rag/rag/routes/summary.py` -- Same `language` field support.
- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/components/LanguageSelector.tsx` -- Dropdown to select output language. Options: English (default), Spanish, French, German, Hindi, Arabic, Chinese, Japanese, Portuguese, Russian. Persisted in localStorage.
- **Dependencies**: Steps 1.10, 1.11
- **Risk**: Medium -- translation quality varies by model and language. Mitigation: use `mistral-saba-24b` for non-English; fall back to English if translation quality is poor.
- **Test**: Request with `language: "Spanish"` returns Spanish text (mock test verifies prompt includes language instruction)

#### Step 4.2: Mobile Responsive Design

- **Files modified**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/page.tsx` -- Restructure layout for mobile: single column on `sm:`, two columns on `lg:`. Collapsible sidebar for chat on mobile. Bottom navigation tabs instead of side tabs.
  - `C:\Users\Dell\Desktop\youtube-rag/components/VideoPlayer.tsx` -- Full-width on mobile, fixed aspect ratio.
  - `C:\Users\Dell\Desktop\youtube-rag/components/ChatPanel.tsx` -- Full-screen overlay on mobile with slide-up animation.
  - All components -- Review and fix Tailwind responsive classes (`sm:`, `md:`, `lg:` breakpoints).
- **Dependencies**: Step 3.8
- **Risk**: Low -- Tailwind makes responsive design straightforward
- **Test**: Playwright tests with mobile viewport (375x667 iPhone SE, 390x844 iPhone 14). All features accessible.

#### Step 4.3: Performance Optimization

- **Actions**:
  1. **Frontend**:
     - Add `loading.tsx` files for Suspense boundaries in `app/`, `app/dashboard/`, `app/shared/[shareId]/`
     - Lazy-load heavy components: `FlashcardViewer`, `TranscriptViewer` using `next/dynamic`
     - Add `<Image>` component for any static images (Next.js optimized)
     - Review and minimize client-side JavaScript bundle
  2. **Python backend**:
     - Add response caching: cache transcript fetch results (LRU cache, 100 entries)
     - Cache summary results per video_id + mode (avoid re-generating)
     - Add `X-Cache-Status` header to indicate cache hit/miss
  3. **API routes**:
     - Add rate limiting middleware (simple token bucket per IP, 30 requests/minute)
     - Add request timeout handling (30s default)
- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/loading.tsx`
  - `C:\Users\Dell\Desktop\youtube-rag/app/dashboard/loading.tsx`
  - `C:\Users\Dell\Desktop\youtube-rag/rag/cache.py` -- LRU cache decorator for transcript and summary
  - `C:\Users\Dell\Desktop\youtube-rag/lib/rate-limit.ts` -- Simple in-memory rate limiter for API routes
- **Dependencies**: All previous phases
- **Risk**: Low
- **Test**: Lighthouse audit on home page (target: Performance 90+, Accessibility 90+, Best Practices 90+)

#### Step 4.4: Error Boundary and Empty States

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/app/error.tsx` -- Global error boundary with "Something went wrong" UI and retry button
  - `C:\Users\Dell\Desktop\youtube-rag/app/not-found.tsx` -- Custom 404 page
  - `C:\Users\Dell\Desktop\youtube-rag/components/EmptyState.tsx` -- Reusable empty state component with icon, title, description, and optional action button. Used in dashboard (no saved notes), chat (no messages yet), flashcards (not generated yet).
- **Dependencies**: Step 3.8
- **Risk**: Low
- **Test**: Error boundary catches thrown errors, 404 page renders

#### Step 4.5: Final E2E Suite

- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/full-suite.spec.ts` -- Complete E2E covering all 5 critical user journeys:
    1. Paste URL -> video loads -> transcript extracted -> summary displays
    2. Ask question -> RAG returns grounded answer -> ask follow-up
    3. Generate flashcards -> flip through -> view topics -> search transcript
    4. Login -> save notes -> share notes -> verify share link -> logout -> login -> notes persist
    5. Mobile viewport: all features accessible, responsive layout works
  - Run in Chrome and Firefox.
- **Dependencies**: All phases
- **Risk**: Medium
- **Test**: `npm run test:e2e` passes in both browsers

#### Step 4.6: Phase 4 Verification Gate (Final)

- **Action**: Complete verification orchestrator:
  - Full E2E suite across all 5 critical journeys in Chrome + Firefox
  - Mobile viewport tests pass
  - Lighthouse: Performance 90+, Accessibility 90+
  - Security: full scan, zero CRITICAL/HIGH issues, no hardcoded secrets
  - Coverage: 80%+ unit + integration across frontend (Vitest) and backend (pytest)
  - All previous phase gates still pass
  - `npm run build` passes
  - `npx tsc --noEmit` passes
  - `cd rag && pytest -v` passes
  - `cd rag && ruff check .` passes
- **Pass criteria**: ALL checks green. Ship it.

---

### PHASE 5: Accounts, Keys, and Deployment (Final Step)

**Goal**: Create all external service accounts, insert real API keys, deploy.

---

#### Step 5.1: Create Supabase Project

- **Action**:
  1. Go to https://supabase.com and create a free account
  2. Create a new project (choose a region close to your users)
  3. In the SQL Editor, run the migration files in order:
     - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/001_initial_schema.sql`
     - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/002_shared_notes.sql`
     - `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/003_flashcards.sql`
  4. Go to Settings > API and copy:
     - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
     - Anon (public) key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Service role key -> `SUPABASE_SERVICE_ROLE_KEY`
  5. Go to Authentication > Settings and configure:
     - Enable email/password signups
     - Set site URL to your Vercel domain (after Step 5.4)
     - Add `http://localhost:3000` to redirect URLs for local dev
- **Dependencies**: Steps 2.1, 3.7, 3.9 (migrations must be written)
- **Risk**: Low
- **Test**: Run a test query in the Supabase SQL editor to verify tables exist

#### Step 5.2: Create Groq Account

- **Action**:
  1. Go to https://console.groq.com and create a free account
  2. Go to API Keys and generate a new key
  3. Copy the key -> `GROQ_API_KEY`
  4. Note the free tier limits: 30 RPM, 14,400 RPD for `llama-3.3-70b-versatile`
- **Dependencies**: None
- **Risk**: Low
- **Test**: `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models` returns model list

#### Step 5.3: (Optional) Create Google AI Studio Account for Fallback

- **Action**:
  1. Go to https://aistudio.google.com
  2. Get an API key
  3. Copy -> `GOOGLE_API_KEY`
  4. This is the fallback when Groq is rate-limited
- **Dependencies**: None
- **Risk**: Low

#### Step 5.4: Update All Environment Files

- **Action**: Replace all placeholder values in:
  - `C:\Users\Dell\Desktop\youtube-rag/.env.local` -- all six env vars with real values
  - `C:\Users\Dell\Desktop\youtube-rag/rag/.env` -- `GROQ_API_KEY` with real value
- **Dependencies**: Steps 5.1, 5.2, 5.3
- **Risk**: High -- must never commit these files. Verify `.gitignore` covers them.
- **Test**: `npm run dev` starts without env var warnings; Python service connects to Groq successfully

#### Step 5.5: Deploy Python RAG Service to Railway

- **Action**:
  1. Go to https://railway.app and create a free account (requires GitHub)
  2. Create a new project, connect to the GitHub repo
  3. Set the root directory to `rag/`
  4. Add environment variables: `GROQ_API_KEY`, `GOOGLE_API_KEY`
  5. Railway auto-detects Python and deploys
  6. Copy the public URL (e.g., `https://youtube-rag-production.up.railway.app`)
  7. Update `RAG_SERVICE_URL` in the Next.js env vars to this URL
- **Files created**:
  - `C:\Users\Dell\Desktop\youtube-rag/rag/Procfile` -- `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
  - `C:\Users\Dell\Desktop\youtube-rag/rag/runtime.txt` -- `python-3.10`
- **Dependencies**: Step 5.4
- **Risk**: Medium -- Railway free tier has 500 hours/month and 512MB RAM. Embedding model (~130MB) fits. Mitigation: use smaller BGE-small model; if Railway is too constrained, switch to a Dockerfile-based deployment that caches the model in the image layer.
- **Test**: `curl https://<railway-url>/health` returns `{"status":"ok"}`

#### Step 5.6: Deploy Frontend to Vercel

- **Action**:
  1. Go to https://vercel.com and create a free account (requires GitHub)
  2. Import the GitHub repo
  3. Set root directory to `.` (project root)
  4. Add environment variables in Vercel dashboard:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GROQ_API_KEY`
     - `GOOGLE_API_KEY`
     - `RAG_SERVICE_URL` (Railway URL from Step 5.5)
  5. Deploy
  6. Copy the Vercel domain and update Supabase redirect URLs (Step 5.1 item 5)
- **Dependencies**: Steps 5.4, 5.5
- **Risk**: Low
- **Test**: Visit the Vercel URL, paste a YouTube URL, verify the full flow works

#### Step 5.7: Post-Deployment Smoke Test

- **Action**: Manually verify all critical flows on the live deployment:
  1. Open the Vercel URL in Chrome and Firefox
  2. Paste a YouTube video URL -> video loads
  3. Generate summary -> summary displays
  4. Ask a question -> get a grounded answer
  5. Sign up with email -> check email for confirmation
  6. Log in -> save a note -> see it on dashboard
  7. Share the note -> open share link in incognito
  8. Generate flashcards -> flip through them
  9. View key topics -> click a timestamp
  10. Open transcript viewer -> search for a term
  11. Test on mobile (or Chrome DevTools responsive mode)
- **Dependencies**: Step 5.6
- **Risk**: Medium -- production issues may differ from local
- **Test**: All 11 checks pass manually

---

## File Summary (All Files Created)

### Root Config (6 files)
- `C:\Users\Dell\Desktop\youtube-rag/.gitignore`
- `C:\Users\Dell\Desktop\youtube-rag/.env.local`
- `C:\Users\Dell\Desktop\youtube-rag/.env.example`
- `C:\Users\Dell\Desktop\youtube-rag/vitest.config.ts`
- `C:\Users\Dell\Desktop\youtube-rag/playwright.config.ts`
- `C:\Users\Dell\Desktop\youtube-rag/middleware.ts`

### TypeScript Types (2 files)
- `C:\Users\Dell\Desktop\youtube-rag/types/api.ts`
- `C:\Users\Dell\Desktop\youtube-rag/types/chat.ts`

### Library Utilities (7 files)
- `C:\Users\Dell\Desktop\youtube-rag/lib/constants.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/validation.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/youtube.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/supabase.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/auth.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/rag-client.ts`
- `C:\Users\Dell\Desktop\youtube-rag/lib/rate-limit.ts`

### Components (15 files)
- `C:\Users\Dell\Desktop\youtube-rag/components/VideoPlayer.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/UrlInput.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/SummaryView.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/ChatPanel.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/ChatMessage.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/NotesEditor.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/AuthButton.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/AuthProvider.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/FlashcardViewer.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/FlashCard.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/TopicsList.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/TranscriptViewer.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/LanguageSelector.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/NoteCard.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/SessionCard.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/components/EmptyState.tsx`

### Next.js Pages (8 files)
- `C:\Users\Dell\Desktop\youtube-rag/app/page.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/layout.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/loading.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/error.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/not-found.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/auth/login/page.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/auth/signup/page.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/auth/callback/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/dashboard/page.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/dashboard/loading.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/app/shared/[shareId]/page.tsx`

### Next.js API Routes (10 files)
- `C:\Users\Dell\Desktop\youtube-rag/app/api/transcript/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/qa/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/summary/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/[id]/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/notes/[id]/share/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/chat/sessions/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/chat/sessions/[id]/messages/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/flashcards/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/flashcards/save/route.ts`
- `C:\Users\Dell\Desktop\youtube-rag/app/api/topics/route.ts`

### Python RAG Service (15 files)
- `C:\Users\Dell\Desktop\youtube-rag/rag/requirements.txt`
- `C:\Users\Dell\Desktop\youtube-rag/rag/.env`
- `C:\Users\Dell\Desktop\youtube-rag/rag/.env.example`
- `C:\Users\Dell\Desktop\youtube-rag/rag/main.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/config.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/models.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/transcript.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/embeddings.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/vectorstore.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/store_manager.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/chain.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/prompts.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/cache.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/routes/transcript.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/routes/qa.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/routes/summary.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/routes/flashcards.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/routes/topics.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/Procfile`
- `C:\Users\Dell\Desktop\youtube-rag/rag/runtime.txt`
- `C:\Users\Dell\Desktop\youtube-rag/rag/pytest.ini`
- `C:\Users\Dell\Desktop\youtube-rag/rag/ruff.toml`
- `C:\Users\Dell\Desktop\youtube-rag/rag/conftest.py`

### Supabase Migrations (3 files)
- `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/001_initial_schema.sql`
- `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/002_shared_notes.sql`
- `C:\Users\Dell\Desktop\youtube-rag/supabase/migrations/003_flashcards.sql`

### Tests (20+ files)
- `C:\Users\Dell\Desktop\youtube-rag/tests/setup.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/lib/validation.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/lib/youtube.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/VideoPlayer.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/UrlInput.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/SummaryView.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/ChatPanel.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/NotesEditor.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/AuthButton.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/FlashcardViewer.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/TopicsList.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/TranscriptViewer.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/components/NoteCard.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/transcript.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/qa.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/notes.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/chat-sessions.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/api/share.test.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/auth/login.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/dashboard.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/unit/shared-page.test.tsx`
- `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/mvp.spec.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/auth.spec.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/enhanced.spec.ts`
- `C:\Users\Dell\Desktop\youtube-rag/tests/e2e/full-suite.spec.ts`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_transcript.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_vectorstore.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_chain.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_routes_qa.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_routes_summary.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_flashcards.py`
- `C:\Users\Dell\Desktop\youtube-rag/rag/tests/test_topics.py`

---

## Dependency Graph (Simplified)

```
Phase 1 (MVP):
  1.1 Git Init
   |
   +-- 1.2 Next.js Scaffold
   |    |
   |    +-- 1.3 Test Config
   |    +-- 1.4 Types ----------+
   |    +-- 1.5 Env Template    |
   |    +-- 1.6 Utilities ------+-- 1.12 VideoPlayer
   |                            |-- 1.13 UrlInput
   |                            |-- 1.14 SummaryView
   |                            |-- 1.15 ChatPanel
   |                            |-- 1.16 API Proxy Routes
   |                            |         |
   +-- 1.7 Python Scaffold      |         |
        |                       |         |
        +-- 1.8 Transcript --+  |         |
        +-- 1.9 Embeddings --+--+-- 1.10 RAG Chain
                              |          |
                              +-- 1.11 Python API Routes
                              |
                              +-- 1.17 Home Page (all components)
                              +-- 1.18 NotesEditor
                              +-- 1.19 Python Tests
                              +-- 1.20 E2E Test
                              +-- 1.21 Phase 1 Gate

Phase 2 (Auth):
  2.1 Schema (independent) ---+
  2.2 Supabase Client Lib ----+-- 2.3 Supabase Utils
                               |     |
                               +-- 2.4 Auth Pages
                               +-- 2.5 Layout Integration
                               +-- 2.6 Notes API
                               +-- 2.7 Chat History API
                               +-- 2.8 Notes Persistence
                               +-- 2.9 Chat Persistence
                               +-- 2.10 Dashboard
                               +-- 2.11 Middleware
                               +-- 2.12 E2E
                               +-- 2.13 Phase 2 Gate

Phase 3 (Enhanced):
  3.1 Flashcards (Python) ----+
  3.2 Topics (Python) --------+-- 3.3 API Proxies
                               +-- 3.4 Flashcard Component
                               +-- 3.5 Topics Component
                               +-- 3.6 Transcript Viewer
                               +-- 3.7 Share Notes
                               +-- 3.8 Updated Home Page
                               +-- 3.9 Flashcard DB
                               +-- 3.10 E2E
                               +-- 3.11 Phase 3 Gate

Phase 4 (Polish):
  4.1 Multi-language
  4.2 Mobile Responsive
  4.3 Performance
  4.4 Error Boundaries
  4.5 Final E2E
  4.6 Phase 4 Gate

Phase 5 (Deploy -- accounts created here):
  5.1 Supabase Account
  5.2 Groq Account
  5.3 Google AI (optional)
  5.4 Update Env Files
  5.5 Deploy Python to Railway
  5.6 Deploy Frontend to Vercel
  5.7 Smoke Test
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Groq free tier rate limits (30 RPM) | High | Add exponential backoff retry; cache responses per video; fall back to Gemini |
| `youtube-transcript-api` breaks on YouTube changes | High | Fall back to `YoutubeLoader` from langchain-community; graceful error message |
| Railway 512MB RAM limit with embedding model | Medium | Use BGE-small (130MB); cache model in Docker layer; monitor memory |
| Supabase free tier limits (500MB DB, 50K auth users) | Low | More than sufficient for development and small-scale use |
| LLM generates malformed JSON for flashcards/topics | Medium | Validate with Pydantic; retry with stricter prompt; fall back to text parsing |
| Long transcripts cause slow embedding | Medium | Cache embeddings per video; show progress indicator; use chunked processing |
| Vercel serverless cold starts for API routes | Low | Keep routes lightweight (proxy only); Python service handles heavy work |

---

## Success Criteria

- [ ] Paste any YouTube URL with captions and get a working video player, summary, and Q&A
- [ ] RAG answers are grounded in transcript (not hallucinated)
- [ ] Users can sign up, log in, save notes, and see them on the dashboard
- [ ] Chat history persists across sessions for logged-in users
- [ ] Flashcards generate correctly from video content
- [ ] Key topics link to correct video timestamps
- [ ] Transcript viewer search highlights matches
- [ ] Shared note links work without authentication (read-only)
- [ ] Multi-language responses work for supported languages
- [ ] All pages are usable on mobile (375px viewport)
- [ ] Lighthouse: Performance 90+, Accessibility 90+
- [ ] Test coverage: 80%+ for both frontend and backend
- [ ] Zero hardcoded secrets in the repository
- [ ] All free tiers: total cost is $0
