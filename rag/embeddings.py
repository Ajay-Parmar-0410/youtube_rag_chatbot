from __future__ import annotations

from functools import lru_cache

from langchain_core.embeddings import Embeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from config import get_settings


@lru_cache(maxsize=1)
def get_embeddings() -> Embeddings:
    """Return a cached GoogleGenerativeAIEmbeddings instance.

    Uses Google's text-embedding-004 model via the free Gemini API.
    Requires GOOGLE_API_KEY environment variable.
    """
    settings = get_settings()
    return GoogleGenerativeAIEmbeddings(
        model=settings.EMBEDDING_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
    )
