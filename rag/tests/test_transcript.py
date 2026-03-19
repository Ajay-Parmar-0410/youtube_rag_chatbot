from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from models import TranscriptResponse, TranscriptSegment
from transcript import TranscriptFetchError, fetch_transcript


def _make_response(source: str = "youtube-transcript-api") -> TranscriptResponse:
    return TranscriptResponse(
        segments=[
            TranscriptSegment(text="Hello world", start=0.0, duration=2.0),
            TranscriptSegment(text="Testing transcripts", start=2.0, duration=3.0),
        ],
        full_text="Hello world Testing transcripts",
        source=source,
    )


class TestFetchTranscript:
    @pytest.mark.asyncio()
    async def test_fetch_via_primary_provider(self):
        with patch(
            "transcript._fetch_via_yt_transcript_api",
            return_value=_make_response("youtube-transcript-api"),
        ):
            result = await fetch_transcript("abc123")

        assert len(result.segments) == 2
        assert result.segments[0].text == "Hello world"
        assert result.full_text == "Hello world Testing transcripts"
        assert result.source == "youtube-transcript-api"

    @pytest.mark.asyncio()
    async def test_fallback_to_ytdlp_when_primary_fails(self):
        with (
            patch(
                "transcript._fetch_via_yt_transcript_api",
                side_effect=TranscriptFetchError("primary failed"),
            ),
            patch(
                "transcript._fetch_via_ytdlp",
                return_value=_make_response("yt-dlp"),
            ),
        ):
            result = await fetch_transcript("abc123")

        assert result.source == "yt-dlp"
        assert result.segments[0].text == "Hello world"

    @pytest.mark.asyncio()
    async def test_fallback_to_whisper_when_all_others_fail(self):
        with (
            patch(
                "transcript._fetch_via_yt_transcript_api",
                side_effect=TranscriptFetchError("fail 1"),
            ),
            patch(
                "transcript._fetch_via_ytdlp",
                side_effect=TranscriptFetchError("fail 2"),
            ),
            patch(
                "transcript._fetch_via_whisper",
                return_value=_make_response("faster-whisper"),
            ),
        ):
            result = await fetch_transcript("abc123")

        assert result.source == "faster-whisper"

    @pytest.mark.asyncio()
    async def test_all_providers_fail_raises_error(self):
        with (
            patch(
                "transcript._fetch_via_yt_transcript_api",
                side_effect=TranscriptFetchError("fail 1"),
            ),
            patch(
                "transcript._fetch_via_ytdlp",
                side_effect=TranscriptFetchError("fail 2"),
            ),
            patch(
                "transcript._fetch_via_whisper",
                side_effect=TranscriptFetchError("fail 3"),
            ),
        ):
            with pytest.raises(TranscriptFetchError, match="All transcript providers failed"):
                await fetch_transcript("abc123")

    @pytest.mark.asyncio()
    async def test_empty_video_id_raises_immediately(self):
        with pytest.raises(TranscriptFetchError, match="empty"):
            await fetch_transcript("")

    @pytest.mark.asyncio()
    async def test_segments_have_timing(self):
        with patch(
            "transcript._fetch_via_yt_transcript_api",
            return_value=_make_response(),
        ):
            result = await fetch_transcript("abc123")

        assert result.segments[0].start == 0.0
        assert result.segments[0].duration == 2.0
        assert result.segments[1].start == 2.0

    @pytest.mark.asyncio()
    async def test_response_includes_source_field(self):
        with patch(
            "transcript._fetch_via_yt_transcript_api",
            return_value=_make_response("youtube-transcript-api"),
        ):
            result = await fetch_transcript("abc123")

        assert result.source in ("youtube-transcript-api", "yt-dlp", "faster-whisper")

    @pytest.mark.asyncio()
    async def test_skips_failed_provider_and_logs(self):
        """First provider fails, second succeeds — result comes from second."""
        with (
            patch(
                "transcript._fetch_via_yt_transcript_api",
                side_effect=Exception("network error"),
            ),
            patch(
                "transcript._fetch_via_ytdlp",
                return_value=_make_response("yt-dlp"),
            ),
        ):
            result = await fetch_transcript("abc123")

        assert result.source == "yt-dlp"
