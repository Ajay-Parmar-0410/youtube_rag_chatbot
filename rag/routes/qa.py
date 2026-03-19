from __future__ import annotations

import logging
import re

from fastapi import APIRouter

from chain import create_qa_chain
from models import ApiResponse, QARequest, QAResponse
from store_manager import get_or_create_store
from transcript import TranscriptFetchError, fetch_transcript
from vectorstore import get_retriever

logger = logging.getLogger(__name__)

router = APIRouter()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,20}$")


@router.post("")
async def ask_question(request: QARequest) -> ApiResponse:
    """Answer a question about a YouTube video using RAG."""
    if not VIDEO_ID_PATTERN.match(request.video_id):
        return ApiResponse(
            success=False,
            error="Invalid video ID format. Must be 1-20 alphanumeric characters.",
        )

    try:
        if request.transcript_text:
            transcript_text = request.transcript_text
        else:
            transcript = await fetch_transcript(request.video_id)
            transcript_text = transcript.full_text
        store = await get_or_create_store(request.video_id, transcript_text)
        retriever = get_retriever(store)
        chain = create_qa_chain(retriever, language=request.language)
        answer = await chain.ainvoke(request.question)
        response = QAResponse(answer=answer)
        return ApiResponse(success=True, data=response.model_dump())
    except TranscriptFetchError as exc:
        logger.warning("QA failed for %s: %s", request.video_id, exc)
        return ApiResponse(success=False, error=str(exc))
    except Exception as exc:
        logger.exception("QA chain error for %s", request.video_id)
        return ApiResponse(success=False, error=f"Failed to process question: {exc}")
