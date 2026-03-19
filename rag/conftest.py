from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from models import TranscriptResponse, TranscriptSegment


@pytest.fixture()
def sample_transcript_segments() -> list[dict]:
    """Raw transcript segment data as returned by youtube_transcript_api."""
    return [
        {"text": "Hello and welcome to this video.", "start": 0.0, "duration": 3.5},
        {"text": "Today we will discuss Python.", "start": 3.5, "duration": 2.8},
        {"text": "Python is a great language.", "start": 6.3, "duration": 2.5},
        {"text": "Let's look at some examples.", "start": 8.8, "duration": 3.0},
    ]


@pytest.fixture()
def sample_transcript_text() -> str:
    """Full transcript text for testing."""
    return (
        "Hello and welcome to this video. "
        "Today we will discuss Python. "
        "Python is a great language. "
        "Let's look at some examples."
    )


@pytest.fixture()
def sample_transcript_response() -> TranscriptResponse:
    """A TranscriptResponse object for testing."""
    segments = [
        TranscriptSegment(text="Hello and welcome.", start=0.0, duration=3.5),
        TranscriptSegment(text="Today we discuss Python.", start=3.5, duration=2.8),
    ]
    return TranscriptResponse(
        segments=segments,
        full_text="Hello and welcome. Today we discuss Python.",
    )


@pytest.fixture()
def mock_groq_llm() -> MagicMock:
    """Mock ChatGroq LLM that returns a predictable response."""
    mock = MagicMock()
    mock.ainvoke = AsyncMock(return_value=MagicMock(content="This is a mock answer."))
    mock.invoke = MagicMock(return_value=MagicMock(content="This is a mock answer."))
    return mock


@pytest.fixture()
def sample_video_id() -> str:
    """A valid YouTube video ID for testing."""
    return "dQw4w9WgXcQ"
