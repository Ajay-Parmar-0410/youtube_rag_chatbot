from __future__ import annotations

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from vectorstore import create_vectorstore

_store_cache: dict[str, FAISS] = {}


async def get_or_create_store(video_id: str, transcript_text: str) -> FAISS:
    """Get an existing FAISS store or create one from transcript text.

    Caches stores in memory by video_id.
    """
    if video_id in _store_cache:
        return _store_cache[video_id]

    if not transcript_text.strip():
        raise ValueError("Transcript text cannot be empty")

    documents = [
        Document(
            page_content=transcript_text,
            metadata={"video_id": video_id, "source": "youtube_transcript"},
        )
    ]
    store = create_vectorstore(documents)
    _store_cache[video_id] = store
    return store


def has_store(video_id: str) -> bool:
    """Check if a vector store exists for the given video_id."""
    return video_id in _store_cache


def clear_store(video_id: str) -> None:
    """Remove a cached store. Useful for testing."""
    _store_cache.pop(video_id, None)


def clear_all_stores() -> None:
    """Remove all cached stores. Useful for testing."""
    _store_cache.clear()
