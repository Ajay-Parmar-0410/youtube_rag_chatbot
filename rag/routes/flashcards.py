from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, Response
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq

from cache import flashcards_cache, make_flashcards_key
from config import get_settings
from models import ApiResponse, Flashcard, FlashcardRequest, FlashcardResponse
from prompts import FLASHCARD_PROMPT
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
        temperature=0.4,
    )


def _parse_flashcards(raw: str) -> list[dict]:
    """Parse LLM output into flashcard dicts, handling common issues."""
    text = raw.strip()
    # Extract the JSON array from the output, ignoring any surrounding text
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


@router.post("")
async def generate_flashcards(request: FlashcardRequest, response: Response) -> ApiResponse:
    """Generate flashcards from a YouTube video transcript."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(
            success=False,
            error="Invalid video ID format. Must be 1-20 alphanumeric characters.",
        )

    cache_key = make_flashcards_key(request.video_id, request.language)
    cached = flashcards_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache-Status"] = "hit"
        return ApiResponse(success=True, data=cached)

    response.headers["X-Cache-Status"] = "miss"

    try:
        transcript = await fetch_transcript(request.video_id)
        transcript_text = transcript.full_text[:MAX_TRANSCRIPT_CHARS]

        invoke_input = {"transcript": transcript_text, "count": request.count, "language": request.language or "English"}
        try:
            chain = FLASHCARD_PROMPT | _get_groq_llm() | StrOutputParser()
            raw_output = await chain.ainvoke(invoke_input)
        except Exception as llm_exc:
            if "429" in str(llm_exc) or "rate_limit" in str(llm_exc):
                logger.warning("Groq 70b rate-limited for flashcards, falling back to 8b: %s", llm_exc)
                chain = FLASHCARD_PROMPT | _get_groq_llm(lightweight=True) | StrOutputParser()
                raw_output = await chain.ainvoke(invoke_input)
            else:
                raise

        parsed = _parse_flashcards(raw_output)
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
            flashcards=flashcards, video_id=request.video_id
        ).model_dump()
        flashcards_cache.put(cache_key, response_data)
        return ApiResponse(success=True, data=response_data)

    except TranscriptFetchError as exc:
        logger.warning("Flashcard generation failed for %s: %s", request.video_id, exc)
        return ApiResponse(success=False, error=str(exc))
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("Failed to parse flashcard output: %s", exc)
        return ApiResponse(
            success=False,
            error="Failed to parse flashcard response from AI. Please try again.",
        )
    except Exception as exc:
        logger.exception("Flashcard generation error for %s", request.video_id)
        return ApiResponse(
            success=False, error=f"Failed to generate flashcards: {exc}"
        )
