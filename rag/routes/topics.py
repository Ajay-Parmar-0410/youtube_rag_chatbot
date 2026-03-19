from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, Response
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq

from cache import make_topics_key, topics_cache
from config import get_settings
from models import ApiResponse, Topic, TopicsRequest, TopicsResponse
from prompts import MULTILINGUAL_TOPICS_PROMPT, TOPICS_PROMPT
from transcript import TranscriptFetchError, fetch_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")

MAX_TRANSCRIPT_CHARS = 30_000


def _get_groq_llm(lightweight: bool = False) -> ChatGroq:
    """Create a Groq LLM. Uses 70b by default, 8b if lightweight."""
    settings = get_settings()
    model = settings.LIGHTWEIGHT_MODEL if lightweight else settings.MODEL_NAME
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.3,
    )


def _parse_topics(raw: str) -> list[dict]:
    """Parse LLM output into topic dicts, handling common issues."""
    text = raw.strip()
    # Extract the JSON array from the output, ignoring any surrounding text
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


@router.post("")
async def extract_topics(request: TopicsRequest, response: Response) -> ApiResponse:
    """Extract key topics from a YouTube video transcript."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(
            success=False,
            error="Invalid video ID format. Must be 1-20 alphanumeric characters.",
        )

    cache_key = make_topics_key(request.video_id, request.language)
    cached = topics_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache-Status"] = "hit"
        return ApiResponse(success=True, data=cached)

    response.headers["X-Cache-Status"] = "miss"

    try:
        if request.transcript_text:
            transcript_text = request.transcript_text[:MAX_TRANSCRIPT_CHARS]
        else:
            transcript = await fetch_transcript(request.video_id)
            transcript_text = transcript.full_text[:MAX_TRANSCRIPT_CHARS]

        invoke_input = {"transcript": transcript_text, "language": request.language or "English"}
        try:
            chain = MULTILINGUAL_TOPICS_PROMPT | _get_groq_llm() | StrOutputParser()
            raw_output = await chain.ainvoke(invoke_input)
        except Exception as llm_exc:
            if "429" in str(llm_exc) or "rate_limit" in str(llm_exc):
                logger.warning("Groq 70b rate-limited for topics, falling back to 8b: %s", llm_exc)
                chain = MULTILINGUAL_TOPICS_PROMPT | _get_groq_llm(lightweight=True) | StrOutputParser()
                raw_output = await chain.ainvoke(invoke_input)
            else:
                raise

        parsed = _parse_topics(raw_output)
        topics = [
            Topic(
                topic=item.get("topic", ""),
                description=item.get("description", ""),
                timestamp_start=float(item.get("timestamp_start", 0)),
            )
            for item in parsed
            if item.get("topic") and item.get("description")
        ]

        response_data = TopicsResponse(topics=topics, video_id=request.video_id).model_dump()
        topics_cache.put(cache_key, response_data)
        return ApiResponse(success=True, data=response_data)

    except TranscriptFetchError as exc:
        logger.warning("Topics extraction failed for %s: %s", request.video_id, exc)
        return ApiResponse(success=False, error=str(exc))
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("Failed to parse topics output: %s", exc)
        return ApiResponse(
            success=False,
            error="Failed to parse topics response from AI. Please try again.",
        )
    except Exception as exc:
        logger.exception("Topics extraction error for %s", request.video_id)
        return ApiResponse(
            success=False, error=f"Failed to extract topics: {exc}"
        )
