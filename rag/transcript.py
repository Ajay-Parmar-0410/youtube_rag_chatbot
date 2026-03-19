from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import tempfile

from cache import transcript_cache
from models import TranscriptResponse, TranscriptSegment

logger = logging.getLogger(__name__)


class TranscriptFetchError(Exception):
    """Raised when all transcript providers fail."""


async def fetch_transcript(video_id: str) -> TranscriptResponse:
    """Fetch transcript using a chain of fallback providers.

    Results are cached in an LRU cache (100 entries).
    Order: youtube-transcript-api -> yt-dlp -> faster-whisper
    """
    if not video_id or not video_id.strip():
        raise TranscriptFetchError("Video ID cannot be empty")

    cached = transcript_cache.get(video_id)
    if cached is not None:
        logger.info("Transcript cache hit for %s", video_id)
        return cached

    providers = [
        ("youtube-transcript-api", _fetch_via_yt_transcript_api),
        ("yt-dlp", _fetch_via_ytdlp),
        ("faster-whisper", _fetch_via_whisper),
    ]

    errors: list[str] = []

    for name, provider in providers:
        try:
            logger.info("Trying transcript provider: %s", name)
            result = await provider(video_id)
            logger.info("Transcript fetched via %s (%d segments)", name, len(result.segments))
            transcript_cache.put(video_id, result)
            return result
        except Exception as exc:
            msg = f"{name}: {exc}"
            logger.warning("Provider %s failed: %s", name, exc)
            errors.append(msg)

    raise TranscriptFetchError(
        f"All transcript providers failed for video {video_id}:\n"
        + "\n".join(f"  - {e}" for e in errors)
    )


# ---------------------------------------------------------------------------
# Provider 1: youtube-transcript-api (fastest, no extra deps)
# ---------------------------------------------------------------------------


async def _fetch_via_yt_transcript_api(video_id: str) -> TranscriptResponse:
    from youtube_transcript_api import (
        NoTranscriptFound,
        TranscriptsDisabled,
        VideoUnavailable,
        YouTubeTranscriptApi,
    )

    api = YouTubeTranscriptApi()

    try:
        transcript_list = api.list(video_id)
    except VideoUnavailable as exc:
        raise TranscriptFetchError(f"Video not found: {video_id}") from exc
    except TranscriptsDisabled as exc:
        raise TranscriptFetchError(f"Transcripts disabled for: {video_id}") from exc

    # Try manual English captions first, then auto-generated English
    try:
        transcript = transcript_list.find_manually_created_transcript(["en"])
    except NoTranscriptFound:
        try:
            transcript = transcript_list.find_generated_transcript(["en"])
        except NoTranscriptFound:
            # No English transcript — try translating any available transcript to English
            available = list(transcript_list)
            if not available:
                raise TranscriptFetchError("No transcripts available")
            transcript = None
            for t in available:
                try:
                    transcript = t.translate("en")
                    logger.info("Translating from %s to English", t.language_code)
                    break
                except Exception:
                    pass
            # If translation failed, use the original language transcript
            # English translation will be handled in the multilanguage phase
            if transcript is None:
                transcript = available[0]
                logger.info(
                    "Using original language transcript: %s (English translation unavailable)",
                    available[0].language_code,
                )

    entries = transcript.fetch()
    segments = [
        TranscriptSegment(text=e.text, start=e.start, duration=e.duration)
        for e in entries
    ]
    full_text = " ".join(e.text for e in entries)
    return TranscriptResponse(segments=segments, full_text=full_text, source="youtube-transcript-api")


# ---------------------------------------------------------------------------
# Provider 2: yt-dlp (more robust subtitle extraction)
# ---------------------------------------------------------------------------


async def _fetch_via_ytdlp(video_id: str) -> TranscriptResponse:
    _check_binary("yt-dlp")

    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        sub_path = os.path.join(tmpdir, "subs")

        # Try to download English subtitles (manual first, then auto)
        cmd = [
            "yt-dlp",
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", "en",
            "--sub-format", "json3",
            "--output", sub_path,
            url,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            raise TranscriptFetchError(f"yt-dlp failed: {result.stderr.strip()}")

        # Find the downloaded subtitle file
        sub_file = _find_subtitle_file(tmpdir)
        if not sub_file:
            raise TranscriptFetchError("yt-dlp: no subtitle file produced")

        return _parse_json3_subtitles(sub_file)


def _find_subtitle_file(directory: str) -> str | None:
    """Find first .json3 subtitle file in directory."""
    for fname in os.listdir(directory):
        if fname.endswith(".json3"):
            return os.path.join(directory, fname)
    return None


def _parse_json3_subtitles(filepath: str) -> TranscriptResponse:
    """Parse YouTube json3 subtitle format into TranscriptResponse."""
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)

    events = data.get("events", [])
    segments: list[TranscriptSegment] = []

    for event in events:
        segs = event.get("segs")
        if not segs:
            continue

        text = "".join(s.get("utf8", "") for s in segs).strip()
        text = re.sub(r"\n+", " ", text)

        if not text:
            continue

        start_ms = event.get("tStartMs", 0)
        duration_ms = event.get("dDurationMs", 0)

        segments.append(TranscriptSegment(
            text=text,
            start=start_ms / 1000.0,
            duration=duration_ms / 1000.0,
        ))

    if not segments:
        raise TranscriptFetchError("yt-dlp: subtitle file contained no text")

    full_text = " ".join(s.text for s in segments)
    return TranscriptResponse(segments=segments, full_text=full_text, source="yt-dlp")


# ---------------------------------------------------------------------------
# Provider 3: faster-whisper (audio transcription, last resort)
# ---------------------------------------------------------------------------


async def _fetch_via_whisper(video_id: str) -> TranscriptResponse:
    _check_binary("yt-dlp")

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise TranscriptFetchError(
            "faster-whisper not installed. Run: pip install faster-whisper"
        ) from exc

    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        # Download audio only
        cmd = [
            "yt-dlp",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "5",
            "--output", audio_path,
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            raise TranscriptFetchError(f"yt-dlp audio download failed: {result.stderr.strip()}")

        # Find the actual audio file (yt-dlp may adjust the extension)
        actual_audio = _find_audio_file(tmpdir)
        if not actual_audio:
            raise TranscriptFetchError("No audio file produced by yt-dlp")

        # Transcribe with Whisper (use small model for speed)
        model = WhisperModel("small", device="cpu", compute_type="int8")
        whisper_segments, _info = model.transcribe(actual_audio, language="en")

        segments: list[TranscriptSegment] = []
        for seg in whisper_segments:
            segments.append(TranscriptSegment(
                text=seg.text.strip(),
                start=seg.start,
                duration=seg.end - seg.start,
            ))

        if not segments:
            raise TranscriptFetchError("Whisper produced no transcript segments")

        full_text = " ".join(s.text for s in segments)
        return TranscriptResponse(segments=segments, full_text=full_text, source="faster-whisper")


def _find_audio_file(directory: str) -> str | None:
    """Find first audio file in directory."""
    audio_exts = {".mp3", ".m4a", ".wav", ".opus", ".webm"}
    for fname in os.listdir(directory):
        if os.path.splitext(fname)[1].lower() in audio_exts:
            return os.path.join(directory, fname)
    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_binary(name: str) -> None:
    """Check that a CLI tool is available on PATH."""
    try:
        subprocess.run([name, "--version"], capture_output=True, timeout=5)
    except FileNotFoundError as exc:
        raise TranscriptFetchError(
            f"'{name}' is not installed or not on PATH. "
            f"Install it: https://github.com/yt-dlp/yt-dlp#installation"
        ) from exc
