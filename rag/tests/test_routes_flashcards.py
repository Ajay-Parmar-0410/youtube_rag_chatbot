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
        TranscriptSegment(text="Python is a programming language.", start=0.0, duration=5.0),
        TranscriptSegment(text="It is used for web development.", start=5.0, duration=5.0),
    ]
    return TranscriptResponse(
        segments=segments,
        full_text="Python is a programming language. It is used for web development.",
    )


MOCK_FLASHCARD_JSON = json.dumps([
    {"question": "What is Python?", "answer": "A programming language", "difficulty": "easy"},
    {"question": "What is Python used for?", "answer": "Web development", "difficulty": "medium"},
])


class TestFlashcardsRoute:
    @pytest.mark.asyncio()
    async def test_flashcards_success(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.flashcards.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.flashcards._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value=MOCK_FLASHCARD_JSON)
            mock_llm_fn.return_value = mock_llm

            with patch("routes.flashcards.FLASHCARD_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/flashcards",
                        json={"video_id": "abc123", "count": 2},
                    )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["flashcards"]) == 2
            assert data["data"]["flashcards"][0]["question"] == "What is Python?"
            assert data["data"]["video_id"] == "abc123"

    @pytest.mark.asyncio()
    async def test_flashcards_invalid_video_id(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/flashcards",
                json={"video_id": "!!!bad!!!"},
            )

        data = response.json()
        assert data["success"] is False
        assert "Invalid video ID" in data["error"]

    @pytest.mark.asyncio()
    async def test_flashcards_count_validation(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/flashcards",
                json={"video_id": "abc123", "count": 0},
            )

        assert response.status_code == 422

    @pytest.mark.asyncio()
    async def test_flashcards_transcript_error(self):
        from transcript import TranscriptFetchError

        with patch(
            "routes.flashcards.fetch_transcript",
            new_callable=AsyncMock,
            side_effect=TranscriptFetchError("No transcript"),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/flashcards",
                    json={"video_id": "abc123"},
                )

            data = response.json()
            assert data["success"] is False
            assert "No transcript" in data["error"]

    @pytest.mark.asyncio()
    async def test_flashcards_malformed_json(self, mock_transcript_response: TranscriptResponse):
        with (
            patch(
                "routes.flashcards.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.flashcards._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value="not valid json {{{")
            mock_llm_fn.return_value = mock_llm

            with patch("routes.flashcards.FLASHCARD_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/flashcards",
                        json={"video_id": "abc123"},
                    )

            data = response.json()
            assert data["success"] is False
            assert "parse" in data["error"].lower() or "failed" in data["error"].lower()

    @pytest.mark.asyncio()
    async def test_flashcards_markdown_wrapped_json(self, mock_transcript_response: TranscriptResponse):
        """LLM sometimes wraps JSON in markdown code fences."""
        wrapped = f"```json\n{MOCK_FLASHCARD_JSON}\n```"
        with (
            patch(
                "routes.flashcards.fetch_transcript", new_callable=AsyncMock
            ) as mock_fetch,
            patch("routes.flashcards._get_groq_llm") as mock_llm_fn,
        ):
            mock_fetch.return_value = mock_transcript_response

            mock_llm = MagicMock()
            mock_chain = MagicMock()
            mock_chain.ainvoke = AsyncMock(return_value=wrapped)
            mock_llm_fn.return_value = mock_llm

            with patch("routes.flashcards.FLASHCARD_PROMPT") as mock_prompt:
                mock_prompt.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/flashcards",
                        json={"video_id": "abc123", "count": 2},
                    )

            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["flashcards"]) == 2
