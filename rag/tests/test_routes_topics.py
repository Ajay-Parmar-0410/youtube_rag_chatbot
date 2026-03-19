from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from models import TranscriptResponse, TranscriptSegment


@pytest.fixture()
def mock_transcript_response() -> TranscriptResponse:
    segments = [
        TranscriptSegment(text="Today we discuss Python basics.", start=0.0, duration=10.0),
        TranscriptSegment(text="Now let's talk about web frameworks.", start=60.0, duration=10.0),
    ]
    return TranscriptResponse(
        segments=segments,
        full_text="Today we discuss Python basics. Now let's talk about web frameworks.",
    )


MOCK_TOPICS_JSON = json.dumps([
    {"topic": "Python Basics", "description": "Introduction to Python language", "timestamp_start": 0},
    {"topic": "Web Frameworks", "description": "Overview of web development frameworks", "timestamp_start": 60},
])


class TestTopicsRoute:
    @pytest.mark.asyncio()
    async def test_topics_success(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.topics.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.topics._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value=MOCK_TOPICS_JSON)
            mock_llm_fn.return_value = mock_llm

            with patch("routes.topics.TOPICS_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/topics",
                        json={"video_id": "abc123"},
                    )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["topics"]) == 2
            assert data["data"]["topics"][0]["topic"] == "Python Basics"
            assert data["data"]["topics"][1]["timestamp_start"] == 60
            assert data["data"]["video_id"] == "abc123"

    @pytest.mark.asyncio()
    async def test_topics_invalid_video_id(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/topics",
                json={"video_id": "!!!bad!!!"},
            )

        data = response.json()
        assert data["success"] is False
        assert "Invalid video ID" in data["error"]

    @pytest.mark.asyncio()
    async def test_topics_transcript_error(self):
        from transcript import TranscriptFetchError

        with patch(
            "routes.topics.fetch_transcript",
            new_callable=AsyncMock,
            side_effect=TranscriptFetchError("No transcript"),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/topics",
                    json={"video_id": "abc123"},
                )

            data = response.json()
            assert data["success"] is False
            assert "No transcript" in data["error"]

    @pytest.mark.asyncio()
    async def test_topics_malformed_json(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.topics.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.topics._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="invalid json output")
            mock_llm_fn.return_value = mock_llm

            with patch("routes.topics.TOPICS_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/topics",
                        json={"video_id": "abc123"},
                    )

            data = response.json()
            assert data["success"] is False

    @pytest.mark.asyncio()
    async def test_topics_markdown_wrapped_json(self, mock_transcript_response: TranscriptResponse):
        """LLM sometimes wraps JSON in markdown code fences."""
        wrapped = f"```json\n{MOCK_TOPICS_JSON}\n```"
        with (
            patch(
                "routes.topics.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.topics._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value=wrapped)
            mock_llm_fn.return_value = mock_llm

            with patch("routes.topics.TOPICS_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/topics",
                        json={"video_id": "abc123"},
                    )

            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["topics"]) == 2
