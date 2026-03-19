from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TranscriptRequest(BaseModel, frozen=True):
    """Request to fetch a video transcript."""

    video_id: str = Field(..., min_length=1, max_length=20)


class TranscriptSegment(BaseModel, frozen=True):
    """A single segment of a transcript with timing info."""

    text: str
    start: float
    duration: float


class TranscriptResponse(BaseModel, frozen=True):
    """Full transcript response with segments and concatenated text."""

    segments: list[TranscriptSegment]
    full_text: str
    source: str = "unknown"


class QARequest(BaseModel, frozen=True):
    """Request to ask a question about a video."""

    video_id: str = Field(..., min_length=1, max_length=20)
    question: str = Field(..., min_length=1, max_length=1000)
    chat_history: list[dict[str, str]] = Field(default_factory=list)
    language: str | None = None
    transcript_text: str | None = None


class QAResponse(BaseModel, frozen=True):
    """Response to a Q&A question."""

    answer: str
    sources: list[str] = Field(default_factory=list)


class SummaryRequest(BaseModel, frozen=True):
    """Request to generate a video summary."""

    video_id: str = Field(..., min_length=1, max_length=20)
    mode: Literal["brief", "detailed"] = "brief"
    language: str | None = None
    transcript_text: str | None = None


class SummaryResponse(BaseModel, frozen=True):
    """Generated summary response."""

    summary: str
    mode: str


class FlashcardRequest(BaseModel, frozen=True):
    """Request to generate flashcards from a video."""

    video_id: str = Field(..., min_length=1, max_length=20)
    count: int = Field(default=10, ge=1, le=30)
    language: str | None = None
    transcript_text: str | None = None


class Flashcard(BaseModel, frozen=True):
    """A single flashcard with question and answer."""

    question: str
    answer: str
    difficulty: Literal["easy", "medium", "hard"]


class FlashcardResponse(BaseModel, frozen=True):
    """Generated flashcards response."""

    flashcards: list[Flashcard]
    video_id: str


class TopicsRequest(BaseModel, frozen=True):
    """Request to extract key topics from a video."""

    video_id: str = Field(..., min_length=1, max_length=20)
    language: str | None = None
    transcript_text: str | None = None


class Topic(BaseModel, frozen=True):
    """A single extracted topic with timestamp."""

    topic: str
    description: str
    timestamp_start: float


class TopicsResponse(BaseModel, frozen=True):
    """Extracted topics response."""

    topics: list[Topic]
    video_id: str


class PrefetchRequest(BaseModel, frozen=True):
    """Request to start prefetching all content for a video."""

    video_id: str = Field(..., min_length=1, max_length=20)
    language: str | None = None
    transcript_text: str | None = None


class PrefetchEvent(BaseModel, frozen=True):
    """A single SSE event from the prefetch stream."""

    task: str  # "transcript"|"brief"|"detailed"|"flashcards"|"topics"|"vectorstore"
    status: str  # "started"|"complete"|"error"
    error: str | None = None
    data: Any = None


class ApiResponse(BaseModel, frozen=True):
    """Standard API response envelope."""

    success: bool
    data: Any = None
    error: str | None = None
