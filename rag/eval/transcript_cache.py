"""Local filesystem cache for YouTube transcripts used during evaluation.

Keeps eval runs reproducible: the first run fetches transcripts from YouTube
and writes them to ``fixtures/<video_id>.json``; subsequent runs read from
disk. Delete the fixtures directory (or pass ``refresh=True``) to re-fetch.
"""

from __future__ import annotations

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def fixture_path(video_id: str) -> Path:
    """Return the filesystem path where a video's transcript fixture is stored."""
    return FIXTURES_DIR / f"{video_id}.json"


def load_cached(video_id: str) -> str | None:
    """Return the cached transcript text for a video, or None if not cached."""
    path = fixture_path(video_id)
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("full_text")


def save_cached(video_id: str, full_text: str, source: str) -> None:
    """Persist a transcript to the local fixtures directory."""
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    path = fixture_path(video_id)
    payload = {"video_id": video_id, "source": source, "full_text": full_text}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


async def fetch_or_load(video_id: str, refresh: bool = False) -> str:
    """Return the transcript text for a video, fetching from YouTube if needed.

    Args:
        video_id: The YouTube video ID.
        refresh: If True, bypass the cache and re-fetch.
    """
    if not refresh:
        cached = load_cached(video_id)
        if cached is not None:
            return cached

    # Import here to keep this module import-light when fixtures are present
    from transcript import fetch_transcript

    response = await fetch_transcript(video_id)
    save_cached(video_id, response.full_text, response.source)
    return response.full_text
