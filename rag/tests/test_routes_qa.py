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


class TestQARoute:
    @pytest.mark.asyncio()
    async def test_qa_success(self, mock_transcript_response: TranscriptResponse):
        with (
            patch("routes.qa.fetch_transcript", new_callable=AsyncMock) as mock_fetch,
            patch("routes.qa.get_or_create_store", new_callable=AsyncMock) as mock_store,
            patch("routes.qa.get_retriever") as mock_retriever,
            patch("routes.qa.create_qa_chain") as mock_chain_fn,
        ):
            mock_fetch.return_value = mock_transcript_response
            mock_store.return_value = MagicMock()
            mock_retriever.return_value = MagicMock()

            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="Python is great.")
            mock_chain_fn.return_value = mock_chain

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/qa",
                    json={
                        "video_id": "abc123",
                        "question": "What is this video about?",
                    },
                )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["answer"] == "Python is great."

    @pytest.mark.asyncio()
    async def test_qa_invalid_video_id(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/qa",
                json={"video_id": "!!!invalid!!!", "question": "What?"},
            )

        data = response.json()
        assert data["success"] is False
        assert "Invalid video ID" in data["error"]

    @pytest.mark.asyncio()
    async def test_qa_empty_question(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/qa",
                json={"video_id": "abc123", "question": ""},
            )

        # Pydantic validation should reject empty question
        assert response.status_code == 422

    @pytest.mark.asyncio()
    async def test_qa_question_too_long(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/qa",
                json={"video_id": "abc123", "question": "x" * 1001},
            )

        assert response.status_code == 422

    @pytest.mark.asyncio()
    async def test_qa_transcript_error(self):
        from transcript import TranscriptFetchError

        with patch(
            "routes.qa.fetch_transcript",
            new_callable=AsyncMock,
            side_effect=TranscriptFetchError("Video not found"),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/qa",
                    json={"video_id": "abc123", "question": "What?"},
                )

            data = response.json()
            assert data["success"] is False
            assert "Video not found" in data["error"]
