"""LRU cache for transcript and summary results."""

from __future__ import annotations

import hashlib
from collections import OrderedDict
from typing import Any


class LRUCache:
    """Thread-safe LRU cache with configurable max size."""

    def __init__(self, max_size: int = 100) -> None:
        self._cache: OrderedDict[str, Any] = OrderedDict()
        self._max_size = max_size

    def get(self, key: str) -> Any | None:
        """Get a value from the cache. Returns None if not found."""
        if key not in self._cache:
            return None
        self._cache.move_to_end(key)
        return self._cache[key]

    def put(self, key: str, value: Any) -> None:
        """Put a value into the cache, evicting the oldest if full."""
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        if len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

    def has(self, key: str) -> bool:
        return key in self._cache

    def clear(self) -> None:
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)


# Singleton caches
transcript_cache = LRUCache(max_size=100)
summary_cache = LRUCache(max_size=100)


def make_summary_key(video_id: str, mode: str, language: str | None = None) -> str:
    """Create a cache key for summary results."""
    raw = f"{video_id}:{mode}:{language or 'en'}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# Flashcards and topics caches
flashcards_cache = LRUCache(max_size=50)
topics_cache = LRUCache(max_size=50)


def make_flashcards_key(video_id: str, language: str | None = None) -> str:
    """Create a cache key for flashcard results."""
    raw = f"{video_id}:flashcards:{language or 'en'}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def make_topics_key(video_id: str, language: str | None = None) -> str:
    """Create a cache key for topics results."""
    raw = f"{video_id}:topics:{language or 'en'}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
