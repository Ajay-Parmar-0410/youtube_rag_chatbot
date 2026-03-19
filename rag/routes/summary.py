from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Response

from cache import make_summary_key, summary_cache
from chain import create_summary_chain
from models import ApiResponse, SummaryRequest, SummaryResponse
from transcript import TranscriptFetchError, fetch_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")


@router.post("")
async def generate_summary(
    request: SummaryRequest,
    response: Response,
) -> ApiResponse:
    """Generate a summary of a YouTube video."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(
            success=False,
            error="Invalid video ID format. Must be 1-20 alphanumeric characters.",
        )

    cache_key = make_summary_key(request.video_id, request.mode, request.language)
    cached = summary_cache.get(cache_key)
    if cached is not None:
        response.headers["X-Cache-Status"] = "hit"
        return ApiResponse(success=True, data=cached)

    response.headers["X-Cache-Status"] = "miss"

    try:
        if request.transcript_text:
            transcript_text = request.transcript_text
        else:
            transcript = await fetch_transcript(request.video_id)
            transcript_text = transcript.full_text
        invoke_input: dict[str, str] = {
            "transcript": transcript_text[:30_000],
            "language": request.language or "English",
        }

        # Try primary LLM, fallback to Groq lightweight on rate limit
        try:
            chain = create_summary_chain(mode=request.mode, language=request.language)
            summary_text = await chain.ainvoke(invoke_input)
        except Exception as llm_exc:
            if "RESOURCE_EXHAUSTED" in str(llm_exc) or "429" in str(llm_exc):
                logger.warning("Primary LLM rate-limited, falling back to Groq: %s", llm_exc)
                chain = create_summary_chain(
                    mode=request.mode, language=request.language, force_groq=True,
                )
                summary_text = await chain.ainvoke(invoke_input)
            else:
                raise

        summary_data = SummaryResponse(
            summary=summary_text, mode=request.mode,
        ).model_dump()
        summary_cache.put(cache_key, summary_data)
        return ApiResponse(success=True, data=summary_data)
    except TranscriptFetchError as exc:
        logger.warning("Summary failed for %s: %s", request.video_id, exc)
        return ApiResponse(success=False, error=str(exc))
    except Exception as exc:
        logger.exception("Summary chain error for %s", request.video_id)
        return ApiResponse(success=False, error=f"Failed to generate summary: {exc}")
