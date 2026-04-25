# YouTube RAG Chatbot

Paste a YouTube URL, watch it inline, and chat with the video — ask
questions, get summaries, generate notes and flashcards. All grounded in
the video's transcript via a Retrieval-Augmented Generation (RAG)
pipeline.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-149eca)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)
![FAISS](https://img.shields.io/badge/FAISS-vector_search-blue)
![LangChain](https://img.shields.io/badge/LangChain-LCEL-1c3c3c)

---

## Features

- **Q&A chat over the video** — RAG-grounded answers with chat history
- **Brief & detailed summaries** — Gemini for long-context summaries,
  Groq for fast Q&A
- **Smart notes** — timestamp-linked rich-text notes, exportable to PDF
- **Auto-generated flashcards** — turn the video into spaced-repetition cards
- **Topic extraction** — list the key concepts covered with explanations
- **Inline transcript viewer** — full transcript with click-to-jump timestamps
- **Multi-language support** — answer in any language regardless of
  transcript language
- **Auth + dashboard** — Supabase-backed accounts save chat history,
  notes, and flashcards
- **Evaluated** — see [`rag/eval/BENCHMARKS.md`](rag/eval/BENCHMARKS.md)
  for retrieval accuracy and latency numbers

---

## Architecture

```
┌────────────────────┐    HTTPS    ┌──────────────────────┐
│  Next.js frontend  │ ──────────► │ FastAPI RAG service  │
│  (React 19, App    │             │ (Python, LangChain)  │
│  Router, Tailwind) │ ◄────────── │                      │
└────────┬───────────┘             └──────────┬───────────┘
         │                                    │
         │ Auth, persistence                  │ Embeddings, generation
         ▼                                    ▼
┌────────────────────┐             ┌──────────────────────┐
│  Supabase          │             │  Google Gemini       │
│  (Postgres + Auth) │             │  Groq (Llama 3.3)    │
└────────────────────┘             └──────────────────────┘
```

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, TipTap editor |
| Backend API | Next.js API Routes |
| RAG Service | Python 3.11, FastAPI, LangChain LCEL |
| LLM (Q&A) | Groq `llama-3.3-70b-versatile` (fallback `llama-3.1-8b-instant`) |
| LLM (Summary) | Google `gemini-2.5-flash` |
| Embeddings | Google `gemini-embedding-001` |
| Vector Store | FAISS (in-memory) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |

---

## RAG Pipeline at a Glance

```
YouTube URL
   ↓ youtube-transcript-api → yt-dlp → faster-whisper (3-tier fallback)
transcript
   ↓ RecursiveCharacterTextSplitter (chunk=1000, overlap=200)
chunks
   ↓ gemini-embedding-001 (768-dim)
FAISS index
   ↓ similarity search (k=4)
top chunks
   ↓ LCEL chain: prompt | Groq Llama 3.3 70B | StrOutputParser
grounded answer
```

For the full design rationale, defended choices, and evaluation
methodology, see [`PROJECT_DEFENCE.md`](PROJECT_DEFENCE.md).

---

## Evaluation

The pipeline is benchmarked on a hand-labeled dataset of 20 Q&A pairs
across 4 educational YouTube videos.

| Metric | Score |
|--------|-------|
| hit@1 retrieval | 75.0% |
| **hit@3 retrieval** | **90.0%** |
| hit@5 retrieval | 90.0% |
| MRR | 0.825 |
| p50 latency (best config) | ~1.1 s |
| p95 latency (best config) | ~1.4 s |

Full methodology, per-query breakdown, and reproduction commands:
[`rag/eval/BENCHMARKS.md`](rag/eval/BENCHMARKS.md).

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **npm** (or `pnpm` / `yarn`)
- API keys: Groq, Google AI Studio, Supabase

---

## Setup

### 1. Clone

```bash
git clone https://github.com/Ajay-Parmar-0410/youtube_rag_chatbot.git
cd youtube_rag_chatbot
```

### 2. Install frontend deps

```bash
npm install
```

### 3. Set up the Python RAG service

```bash
cd rag
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
cp rag/.env.example rag/.env
```

Required keys:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com) (free tier) |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com) |

### 5. Run the database migrations

In your Supabase SQL editor, run in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_shared_notes.sql
supabase/migrations/003_flashcards.sql
```

### 6. Start the dev servers

```bash
# Terminal 1 — RAG service
cd rag
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Next.js
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
youtube_rag_chatbot/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # Backend API endpoints
│   ├── auth/               # Login / signup / OAuth callback
│   ├── dashboard/          # Saved notes, chat history, flashcards
│   └── shared/             # Public shared notes
├── components/             # React UI components
├── lib/                    # Frontend utilities (auth, validation, RAG client)
├── rag/                    # Python RAG pipeline (FastAPI service)
│   ├── routes/             # Route handlers (qa, summary, transcript, ...)
│   ├── eval/               # Evaluation harness (dataset, retrieval & latency)
│   ├── chain.py            # LCEL Q&A and summary chains
│   ├── embeddings.py       # Gemini embeddings client
│   ├── transcript.py       # Multi-provider transcript fetcher
│   └── vectorstore.py      # FAISS index + retriever
├── supabase/migrations/    # SQL migrations
├── tests/                  # Vitest unit tests + Playwright E2E
├── BENCHMARKS.md           # → rag/eval/BENCHMARKS.md
└── PROJECT_DEFENCE.md      # Detailed design + evaluation defence
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## How It Works

1. User pastes a YouTube URL.
2. Frontend asks the RAG service to fetch the transcript.
3. Transcript is chunked, embedded, and indexed in an in-memory FAISS
   store.
4. **Q&A:** The user's question is embedded; top-k relevant chunks are
   retrieved and sent to Llama 3.3 70B (via Groq) with a grounded-answer
   prompt.
5. **Summaries:** The full transcript is sent to Gemini 2.5 Flash with a
   brief or detailed summary prompt.
6. Notes, chat history, and flashcards are persisted to Supabase for
   logged-in users.

---

## Documentation

- [`PROJECT_DEFENCE.md`](PROJECT_DEFENCE.md) — full design rationale,
  technology choices, evaluation methodology, trade-offs, and known
  limitations.
- [`rag/eval/BENCHMARKS.md`](rag/eval/BENCHMARKS.md) — evaluation
  methodology and reproducible benchmark results.
