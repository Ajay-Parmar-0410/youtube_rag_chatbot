"""Prefetch engine that orchestrates parallel content generation for a video.

Fetches transcript first, then fires all LLM calls in parallel using dual
Gemini keys (key1 → brief, key2 → detailed) and Groq (flashcards + topics).
Results are stored in existing caches so subsequent route calls are instant.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncGenerator

from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq

from cache import (
    flashcards_cache,
    make_flashcards_key,
    make_summary_key,
    make_topics_key,
    summary_cache,
    topics_cache,
)
from chain import create_summary_chain
from config import get_settings
from models import (
    Flashcard,
    FlashcardResponse,
    PrefetchEvent,
    SummaryResponse,
    Topic,
    TopicsResponse,
)
from prompts import FLASHCARD_PROMPT, MULTILINGUAL_TOPICS_PROMPT
from store_manager import get_or_create_store
from transcript import fetch_transcript

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_CHARS = 30_000


def _parse_json_output(raw: str) -> list[dict]:
    """Parse LLM JSON output, stripping markdown fences if present."""
    text = raw.strip()
    # Extract the JSON array from the output, ignoring any surrounding text
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


def _get_groq_llm(lightweight: bool = False) -> ChatGroq:
    """Create a Groq LLM. Uses 70b by default, 8b if lightweight."""
    settings = get_settings()
    model = settings.LIGHTWEIGHT_MODEL if lightweight else settings.MODEL_NAME
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.4,
    )


async def start_prefetch(
    video_id: str,
    language: str | None = None,
    transcript_text: str | None = None,
) -> AsyncGenerator[PrefetchEvent]:
    """Orchestrate prefetching all content for a video.

    After transcript is fetched, fires all LLM tasks in parallel:
    - Brief summary (Gemini key 1)
    - Detailed summary (Gemini key 2)
    - Flashcards (Groq)
    - Topics (Groq)
    - Vectorstore (local embeddings)

    Yields PrefetchEvent as each task completes.
    """
    lang_param = language if language and language != "English" else None
    t_start = time.monotonic()

    # --- 1. Transcript (use provided text or fetch) ---
    yield PrefetchEvent(task="transcript", status="started")
    if transcript_text:
        logger.info("Prefetch using provided transcript text")
        yield PrefetchEvent(task="transcript", status="complete")
    else:
        try:
            transcript = await fetch_transcript(video_id)
            transcript_text = transcript.full_text
            elapsed = time.monotonic() - t_start
            logger.info("Prefetch transcript done in %.1fs", elapsed)
            yield PrefetchEvent(task="transcript", status="complete")
        except Exception as exc:
            yield PrefetchEvent(task="transcript", status="error", error=str(exc))
            return

    # --- 2. Fire ALL tasks in parallel ---
    yield PrefetchEvent(task="brief", status="started")
    yield PrefetchEvent(task="detailed", status="started")
    yield PrefetchEvent(task="flashcards", status="started")
    yield PrefetchEvent(task="topics", status="started")
    yield PrefetchEvent(task="vectorstore", status="started")

    settings = get_settings()
    gemini_key = settings.GOOGLE_API_KEY_2 if settings.GOOGLE_API_KEY_2 != "placeholder-will-be-replaced" else settings.GOOGLE_API_KEY

    # Create all tasks — brief uses Groq (fast), detailed uses Gemini
    brief_task = asyncio.create_task(
        _generate_summary(video_id, transcript_text, "brief", lang_param)
    )
    detailed_task = asyncio.create_task(
        _generate_summary(video_id, transcript_text, "detailed", lang_param, gemini_key=gemini_key)
    )
    flashcards_task = asyncio.create_task(
        _generate_flashcards(video_id, transcript_text, lang_param)
    )
    topics_task = asyncio.create_task(
        _generate_topics(video_id, transcript_text, lang_param)
    )
    vectorstore_task = asyncio.create_task(
        get_or_create_store(video_id, transcript_text)
    )

    # Map task names to their asyncio tasks
    pending: dict[str, asyncio.Task] = {
        "brief": brief_task,
        "detailed": detailed_task,
        "flashcards": flashcards_task,
        "topics": topics_task,
        "vectorstore": vectorstore_task,
    }

    # Yield events as each task completes (first-finished-first-yielded)
    while pending:
        done, _ = await asyncio.wait(
            pending.values(), return_when=asyncio.FIRST_COMPLETED,
        )
        for completed_task in done:
            # Find which name this task belongs to
            task_name = next(
                name for name, t in pending.items() if t is completed_task
            )
            del pending[task_name]

            elapsed = time.monotonic() - t_start

            if completed_task.exception() is not None:
                exc = completed_task.exception()
                logger.warning("Prefetch %s failed in %.1fs: %s", task_name, elapsed, exc)
                yield PrefetchEvent(task=task_name, status="error", error=str(exc))
            else:
                result = completed_task.result()
                logger.info("Prefetch %s done in %.1fs", task_name, elapsed)

                if task_name == "vectorstore":
                    yield PrefetchEvent(task=task_name, status="complete")
                else:
                    yield PrefetchEvent(task=task_name, status="complete", data=result)

    total = time.monotonic() - t_start
    logger.info("Prefetch complete for %s in %.1fs", video_id, total)


async def _generate_summary(
    video_id: str,
    transcript_text: str,
    mode: str,
    language: str | None,
    gemini_key: str | None = None,
) -> dict:
    """Generate a summary and cache it. Returns the cached dict."""
    cache_key = make_summary_key(video_id, mode, language)
    cached = summary_cache.get(cache_key)
    if cached is not None:
        return cached

    invoke_input: dict[str, str] = {
        "transcript": transcript_text[:MAX_TRANSCRIPT_CHARS],
        "language": language or "English",
    }

    try:
        chain = create_summary_chain(
            mode=mode, language=language, gemini_api_key=gemini_key,
        )
        summary_text = await chain.ainvoke(invoke_input)
    except Exception as llm_exc:
        if "RESOURCE_EXHAUSTED" in str(llm_exc) or "429" in str(llm_exc):
            logger.warning("Gemini rate-limited in prefetch, falling back to Groq: %s", llm_exc)
            chain = create_summary_chain(mode=mode, language=language, force_groq=True)
            summary_text = await chain.ainvoke(invoke_input)
        else:
            raise

    summary_data = SummaryResponse(summary=summary_text, mode=mode).model_dump()
    summary_cache.put(cache_key, summary_data)
    return summary_data


async def _generate_flashcards(
    video_id: str, transcript_text: str, language: str | None = None,
) -> dict:
    """Generate flashcards and cache them. Returns the cached dict."""
    cache_key = make_flashcards_key(video_id, language)
    cached = flashcards_cache.get(cache_key)
    if cached is not None:
        return cached

    invoke_input = {"transcript": transcript_text[:MAX_TRANSCRIPT_CHARS], "count": 10, "language": language or "English"}
    try:
        chain = FLASHCARD_PROMPT | _get_groq_llm() | StrOutputParser()
        raw_output = await chain.ainvoke(invoke_input)
    except Exception as exc:
        if "429" in str(exc) or "rate_limit" in str(exc):
            logger.warning("Groq 70b rate-limited for flashcards, falling back to 8b: %s", exc)
            chain = FLASHCARD_PROMPT | _get_groq_llm(lightweight=True) | StrOutputParser()
            raw_output = await chain.ainvoke(invoke_input)
        else:
            raise

    parsed = _parse_json_output(raw_output)
    flashcards = [
        Flashcard(
            question=item.get("question", ""),
            answer=item.get("answer", ""),
            difficulty=item.get("difficulty", "medium"),
        )
        for item in parsed
        if item.get("question") and item.get("answer")
    ]

    response_data = FlashcardResponse(
        flashcards=flashcards, video_id=video_id
    ).model_dump()
    flashcards_cache.put(cache_key, response_data)
    return response_data


async def _generate_topics(
    video_id: str, transcript_text: str, language: str | None = None,
) -> dict:
    """Generate topics and cache them. Returns the cached dict."""
    cache_key = make_topics_key(video_id, language)
    cached = topics_cache.get(cache_key)
    if cached is not None:
        return cached

    invoke_input = {"transcript": transcript_text[:MAX_TRANSCRIPT_CHARS], "language": language or "English"}
    try:
        chain = MULTILINGUAL_TOPICS_PROMPT | _get_groq_llm() | StrOutputParser()
        raw_output = await chain.ainvoke(invoke_input)
    except Exception as exc:
        if "429" in str(exc) or "rate_limit" in str(exc):
            logger.warning("Groq 70b rate-limited for topics, falling back to 8b: %s", exc)
            chain = MULTILINGUAL_TOPICS_PROMPT | _get_groq_llm(lightweight=True) | StrOutputParser()
            raw_output = await chain.ainvoke(invoke_input)
        else:
            raise

    parsed = _parse_json_output(raw_output)
    topics = [
        Topic(
            topic=item.get("topic", ""),
            description=item.get("description", ""),
            timestamp_start=float(item.get("timestamp_start", 0)),
        )
        for item in parsed
        if item.get("topic") and item.get("description")
    ]

    response_data = TopicsResponse(
        topics=topics, video_id=video_id
    ).model_dump()
    topics_cache.put(cache_key, response_data)
    return response_data
