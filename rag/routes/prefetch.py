"""SSE endpoint for prefetching all video content in the background."""

from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from models import PrefetchRequest
from prefetch import start_prefetch

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")


@router.post("")
async def prefetch_video(request: PrefetchRequest) -> StreamingResponse:
    """Start prefetching all content for a video, streaming progress via SSE."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        error_event = json.dumps(
            {"task": "validation", "status": "error", "error": "Invalid video ID format."}
        )
        return StreamingResponse(
            iter([f"data: {error_event}\n\n"]),
            media_type="text/event-stream",
        )

    async def event_stream():
        async for event in start_prefetch(request.video_id, request.language):
            data = json.dumps(event.model_dump(), default=str)
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
