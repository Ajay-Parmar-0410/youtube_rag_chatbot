---
description: LLM, embedding, and vector store model details and comparison tables
paths: ["rag/**", "*.py", "app/api/**"]
---

# Tech Stack Details

## LLM (Free / Open-Source)

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

## Embeddings (Free / Open-Source)

All run locally via `HuggingFaceEmbeddings` -- no API key needed.

| Model | Dimensions | Speed | Quality | Best For |
|-------|-----------|-------|---------|----------|
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Very fast | Good | MVP, quick prototyping (used in existing code) |
| `sentence-transformers/all-mpnet-base-v2` | 768 | Medium | Better | Production upgrade, more accurate retrieval |
| `BAAI/bge-small-en-v1.5` | 384 | Very fast | Better | Best quality-to-speed ratio, **recommended** |
| `BAAI/bge-base-en-v1.5` | 768 | Medium | Best | Maximum retrieval quality |
| `nomic-ai/nomic-embed-text-v1.5` | 768 | Medium | Best | Long context support (8192 tokens) |

**Start with** `BAAI/bge-small-en-v1.5`. Upgrade to `nomic-embed-text-v1.5` if longer chunks needed.

## Vector Store

- **MVP**: FAISS (in-memory, fast, no server needed)
- **Production**: Supabase pgvector (free tier, persistent)
- **Alternative**: ChromaDB (local, persistent, easy setup)
