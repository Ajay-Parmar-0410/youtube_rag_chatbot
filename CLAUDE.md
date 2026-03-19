# YouTube RAG

A web app where users paste a YouTube URL, watch the video inline, and interact with its content via AI -- summary, Q&A, notes -- built on a zero-cost stack.

## Core Features

1. **Video Summary** -- concise summaries (brief + detailed)
2. **Smart Notes** -- timestamp-linked, AI-assisted, exportable as markdown
3. **Question & Answer** -- RAG-powered, context-grounded, with conversation history
4. **Embedded Video Player** -- YouTube video inline for reference
5. **Future**: flashcards, key topics, transcript viewer, chat history, share notes, multi-language

## Auth & Multi-User

- All features usable **without login**
- **Login required** to save/persist notes, history, flashcards
- Supabase Auth (free tier -- email/password + OAuth)
- Row-level security for user data isolation

## Tech Stack (Zero-Cost)

- **Frontend**: Next.js (App Router) + Tailwind CSS → Vercel (free)
- **Backend**: Next.js API Routes + Python RAG service
- **RAG**: LangChain + LangGraph
- **LLM**: Groq free tier (`llama-3.3-70b-versatile` primary, `llama-3.1-8b-instant` lightweight)
- **Embeddings**: `BAAI/bge-small-en-v1.5` via HuggingFaceEmbeddings (local, free)
- **Vector Store**: FAISS (MVP) → Supabase pgvector (production)
- **Database**: Supabase PostgreSQL (free tier)
- **Python hosting**: Vercel serverless or Railway (free tier)

See `.claude/rules/tech-stack.md` for full model comparison tables.

## File Structure

```
youtube-rag/
|-- app/                    # Next.js App Router pages
|   |-- page.tsx            # Home -- paste URL, watch video, interact
|   |-- auth/               # Login/signup pages
|   |-- dashboard/          # Saved notes, history (auth required)
|   |-- api/
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
|-- rag/                    # Python RAG pipeline
|   |-- chain.py            # RAG chain definition
|   |-- graph.py            # LangGraph workflow
|   |-- embeddings.py       # Embedding generation
|   |-- transcript.py       # YouTube transcript fetcher
|   |-- vectorstore.py      # Vector store operations
|-- types/                  # TypeScript type definitions
|-- public/                 # Static assets
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=              # Primary LLM
GOOGLE_API_KEY=            # Fallback LLM (Gemini)
# Embeddings run locally -- no API key needed
```

> Never commit API keys to git. Use `.env.local` only.

## API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## Key Rules

- Validate all user inputs (URL format, query length)
- Graceful fallback when transcript is unavailable
- Rate limit API routes to stay within free-tier limits
- Immutability always -- never mutate objects
- Files under 800 lines, functions under 50 lines

## Commands

- `/plan` -- create implementation plan
- `/tdd` -- test-driven development workflow
- `/code-review` -- code quality + security review
- `/build-fix` -- fix build errors incrementally
- `/verify` -- run verification orchestrator (see `.claude/skills/verification/`)
- `/e2e` -- run E2E tests for critical flows

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Branch per feature
- PRs require passing `/verify pre-pr` before merge

## Development Phases

1. **MVP** -- transcript + video player + Q&A + summary (no auth)
2. **User Accounts** -- Supabase Auth, save notes/history, dashboard
3. **Enhanced Features** -- flashcards, topics, transcript viewer, share notes
4. **Polish** -- multi-language, mobile responsive, performance

Each phase has a verification gate. See `.claude/skills/phase-check/` for details.
