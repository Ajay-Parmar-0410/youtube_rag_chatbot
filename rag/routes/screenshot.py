from __future__ import annotations

import base64
import io
import logging
import re
import urllib.request

from fastapi import APIRouter
from pydantic import BaseModel, Field

from models import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")


class ScreenshotRequest(BaseModel, frozen=True):
    """Request to capture a video frame at a specific timestamp."""

    video_id: str = Field(..., min_length=1, max_length=20)
    timestamp: float = Field(..., ge=0)


@router.post("")
async def get_screenshot(request: ScreenshotRequest) -> ApiResponse:
    """Extract a video frame at the given timestamp."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(success=False, error="Invalid video ID format.")

    try:
        import asyncio

        base64_image = await asyncio.get_event_loop().run_in_executor(
            None, _extract_frame, request.video_id, request.timestamp
        )
        return ApiResponse(
            success=True,
            data={"image": base64_image, "timestamp": request.timestamp},
        )
    except Exception as exc:
        logger.warning(
            "Screenshot failed for %s at %s: %s",
            request.video_id,
            request.timestamp,
            exc,
        )
        return ApiResponse(success=False, error=str(exc))


def _extract_frame(video_id: str, timestamp: float) -> str:
    """Try multiple methods to get a video frame, from best to fallback."""

    # Method 1: yt-dlp storyboard extraction (best quality, per-frame)
    try:
        return _extract_via_storyboard(video_id, timestamp)
    except Exception as exc:
        logger.info("Storyboard extraction failed: %s. Trying thumbnail.", exc)

    # Method 2: YouTube static thumbnail (always works, but not timestamp-specific)
    return _extract_via_thumbnail(video_id)


def _extract_via_thumbnail(video_id: str) -> str:
    """Fallback: fetch the highest quality static thumbnail available."""
    # Try URLs from highest to lowest quality
    thumbnail_urls = [
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/sddefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
    ]

    for url in thumbnail_urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                # YouTube returns a small grey placeholder for missing thumbnails
                if len(data) > 2000:
                    b64 = base64.b64encode(data).decode("utf-8")
                    return f"data:image/jpeg;base64,{b64}"
        except Exception:
            continue

    raise ValueError("No thumbnail available for this video")


def _extract_via_storyboard(video_id: str, timestamp: float) -> str:
    """Extract a specific frame from YouTube storyboard sprites using yt-dlp."""
    from typing import Any

    import yt_dlp
    from PIL import Image as PILImage

    url = f"https://www.youtube.com/watch?v={video_id}"

    ydl_opts: dict[str, Any] = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if not info:
        raise ValueError("Could not fetch video info")

    # Find storyboard format
    storyboard = None
    for fmt in info.get("formats", []):
        if fmt.get("protocol") == "mhtml" and "columns" in fmt and "rows" in fmt:
            storyboard = fmt

    if not storyboard:
        raise ValueError("No storyboard data available")

    columns: int = storyboard["columns"]
    rows: int = storyboard["rows"]
    fragments: list[dict[str, Any]] = storyboard.get("fragments", [])

    if not fragments:
        raise ValueError("No storyboard fragments found")

    frames_per_fragment = columns * rows
    fragment_duration = fragments[0].get("duration", 0)

    if fragment_duration <= 0:
        video_duration = info.get("duration", 0)
        if video_duration > 0 and len(fragments) > 0:
            fragment_duration = video_duration / len(fragments)
        else:
            raise ValueError("Cannot determine fragment duration")

    frame_duration = fragment_duration / frames_per_fragment

    # Find target fragment
    cumulative_time = 0.0
    target_fragment_idx = 0

    for idx, frag in enumerate(fragments):
        frag_dur = frag.get("duration", fragment_duration)
        if cumulative_time + frag_dur > timestamp:
            target_fragment_idx = idx
            break
        cumulative_time += frag_dur
    else:
        target_fragment_idx = len(fragments) - 1
        cumulative_time = sum(
            f.get("duration", fragment_duration) for f in fragments[:-1]
        )

    time_in_fragment = timestamp - cumulative_time
    frame_index = min(int(time_in_fragment / frame_duration), frames_per_fragment - 1)
    frame_index = max(frame_index, 0)

    frame_row = frame_index // columns
    frame_col = frame_index % columns

    fragment_url = fragments[target_fragment_idx].get("url") or fragments[
        target_fragment_idx
    ].get("path")
    if not fragment_url:
        raise ValueError("Fragment URL not found")

    req = urllib.request.Request(fragment_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        sprite_data = resp.read()

    sprite = PILImage.open(io.BytesIO(sprite_data))
    sprite_w, sprite_h = sprite.size
    frame_w = sprite_w // columns
    frame_h = sprite_h // rows

    left = frame_col * frame_w
    top = frame_row * frame_h
    right = left + frame_w
    bottom = top + frame_h

    frame = sprite.crop((left, top, right, bottom))

    buffer = io.BytesIO()
    frame.save(buffer, format="PNG")
    buffer.seek(0)
    b64 = base64.b64encode(buffer.read()).decode("utf-8")

    return f"data:image/png;base64,{b64}"
