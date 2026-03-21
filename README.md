# YouTube RAG Chatbot

A web app where you paste a YouTube URL, watch the video inline, and interact with its content via AI — summaries, Q&A, and smart notes.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Python](https://img.shields.io/badge/Python-3.11+-blue)

## Features

- **Video Summary** — brief and detailed AI-generated summaries
- **Q&A Chat** — ask questions about the video, powered by RAG (Retrieval-Augmented Generation)
- **Smart Notes** — timestamp-linked, AI-assisted notes with rich text editor, exportable as PDF/Markdown
- **Flashcards** — auto-generated flashcards from video content
- **Key Topics** — extracted topics with explanations
- **Transcript Viewer** — full transcript with timestamp navigation
- **Embedded Player** — YouTube video plays inline for easy reference
- **Dark/Light Theme** — toggle between themes
- **Auth & Dashboard** — sign up to save notes, chat history, and flashcards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend API | Next.js API Routes |
| RAG Service | Python, FastAPI, LangChain |
| LLM | Groq (`llama-3.3-70b-versatile`) with auto-fallback to `llama-3.1-8b-instant` |
| Embeddings | Google Gemini (`gemini-embedding-001`) |
| Vector Store | FAISS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **npm** or **pnpm**

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Ajay-Parmar-0410/youtube_rag_chatbot.git
cd youtube_rag_chatbot
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Set up the Python RAG service

```bash
cd rag
python -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4. Configure environment variables

Copy the example env files and fill in your keys:

```bash
cp .env.example .env.local
cp rag/.env.example rag/.env
```

**Required keys:**

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com) (free tier) |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com) (for embeddings) |

### 5. Set up the database

Run the SQL migrations in your Supabase SQL editor (in order):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_shared_notes.sql
supabase/migrations/003_flashcards.sql
```

### 6. Start the development servers

**Terminal 1 — RAG service:**
```bash
cd rag
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Next.js frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
youtube_rag_chatbot/
├── app/                  # Next.js pages and API routes
│   ├── api/              # Backend API endpoints
│   ├── auth/             # Login/signup pages
│   ├── dashboard/        # User dashboard (saved notes, history)
│   └── shared/           # Shared notes pages
├── components/           # React UI components
├── lib/                  # Shared utilities and helpers
├── rag/                  # Python RAG pipeline (FastAPI)
│   ├── routes/           # API route handlers
│   ├── chain.py          # RAG chain definition
│   ├── embeddings.py     # Embedding generation
│   ├── transcript.py     # YouTube transcript fetcher
│   └── vectorstore.py    # FAISS vector store operations
├── supabase/             # Database migrations
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage |

## How It Works

1. User pastes a YouTube URL
2. The app fetches the video transcript
3. Transcript is chunked and embedded into a FAISS vector store
4. For Q&A, relevant chunks are retrieved and sent to the LLM with the question
5. For summaries, the full transcript is processed by the LLM
6. Notes, flashcards, and chat history are saved to Supabase (when logged in)

