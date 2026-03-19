from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from models import TranscriptResponse, TranscriptSegment


@pytest.fixture()
def mock_transcript_response() -> TranscriptResponse:
    segments = [
        TranscriptSegment(text="Hello", start=0.0, duration=2.0),
    ]
    return TranscriptResponse(segments=segments, full_text="Hello")


class TestSummaryRoute:
    @pytest.mark.asyncio()
    async def test_summary_brief_success(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.summary.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.summary.create_summary_chain") as mock_chain_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="This is a brief summary.")
            mock_chain_fn.return_value = mock_chain

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/summary",
                    json={"video_id": "abc123", "mode": "brief"},
                )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["summary"] == "This is a brief summary."
            assert data["data"]["mode"] == "brief"

    @pytest.mark.asyncio()
    async def test_summary_detailed_success(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.summary.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.summary.create_summary_chain") as mock_chain_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="## Detailed summary here")
            mock_chain_fn.return_value = mock_chain

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/summary",
                    json={"video_id": "abc123", "mode": "detailed"},
                )

            data = response.json()
            assert data["success"] is True
            assert data["data"]["mode"] == "detailed"

    @pytest.mark.asyncio()
    async def test_summary_default_mode_is_brief(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.summary.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.summary.create_summary_chain") as mock_chain_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="Summary")
            mock_chain_fn.return_value = mock_chain

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/summary",
                    json={"video_id": "abc123"},
                )

            data = response.json()
            assert data["success"] is True
            assert data["data"]["mode"] == "brief"

    @pytest.mark.asyncio()
    async def test_summary_invalid_video_id(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/summary",
                json={"video_id": "!!!bad!!!"},
            )

        data = response.json()
        assert data["success"] is False
        assert "Invalid video ID" in data["error"]

    @pytest.mark.asyncio()
    async def test_summary_invalid_mode(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/summary",
                json={"video_id": "abc123", "mode": "invalid"},
            )

        # Pydantic should reject invalid mode
        assert response.status_code == 422

    @pytest.mark.asyncio()
    async def test_summary_transcript_error(self):
        from transcript import TranscriptFetchError

        with patch(
            "routes.summary.fetch_transcript",
            new_callable=AsyncMock,
            side_effect=TranscriptFetchError("No transcript"),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/summary",
                    json={"video_id": "abc123"},
                )

            data = response.json()
            assert data["success"] is False
            assert "No transcript" in data["error"]
