from __future__ import annotations

from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings

from config import get_settings


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    """Return a cached HuggingFaceEmbeddings instance.

    Uses BAAI/bge-small-en-v1.5 model by default.
    """
    settings = get_settings()
    return HuggingFaceEmbeddings(
        model_name=settings.EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )
