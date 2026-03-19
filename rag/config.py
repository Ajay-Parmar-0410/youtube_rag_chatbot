from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    GROQ_API_KEY: str = "placeholder-will-be-replaced"
    GOOGLE_API_KEY: str = "placeholder-will-be-replaced"
    GOOGLE_API_KEY_2: str = "placeholder-will-be-replaced"
    MODEL_NAME: str = "llama-3.3-70b-versatile"
    LIGHTWEIGHT_MODEL: str = "llama-3.1-8b-instant"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    RETRIEVAL_K: int = 4

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
