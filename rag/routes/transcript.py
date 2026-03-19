from __future__ import annotations

import logging
import re

from fastapi import APIRouter

from models import ApiResponse, TranscriptRequest
from transcript import TranscriptFetchError, fetch_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")


@router.post("")
async def get_transcript(request: TranscriptRequest) -> ApiResponse:
    """Fetch transcript for a YouTube video."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(
            success=False,
            error="Invalid video ID format. Must be 1-20 alphanumeric characters.",
        )

    try:
        result = await fetch_transcript(request.video_id)
        return ApiResponse(success=True, data=result.model_dump())
    except TranscriptFetchError as exc:
        logger.warning("Transcript fetch failed for %s: %s", request.video_id, exc)
        return ApiResponse(success=False, error=str(exc))
