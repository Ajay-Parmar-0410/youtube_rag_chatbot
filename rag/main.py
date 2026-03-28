from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import ApiResponse
from routes.flashcards import router as flashcards_router
from routes.prefetch import router as prefetch_router
from routes.qa import router as qa_router
from routes.screenshot import router as screenshot_router
from routes.summary import router as summary_router
from routes.topics import router as topics_router
from routes.test_apis import router as test_apis_router
from routes.transcript import router as transcript_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube RAG Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcript_router, prefix="/transcript", tags=["transcript"])
app.include_router(qa_router, prefix="/qa", tags=["qa"])
app.include_router(summary_router, prefix="/summary", tags=["summary"])
app.include_router(screenshot_router, prefix="/screenshot", tags=["screenshot"])
app.include_router(flashcards_router, prefix="/flashcards", tags=["flashcards"])
app.include_router(topics_router, prefix="/topics", tags=["topics"])
app.include_router(prefetch_router, prefix="/prefetch", tags=["prefetch"])
app.include_router(test_apis_router, prefix="/test-apis", tags=["test-apis"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all exception handler returning ApiResponse envelope."""
    logger.exception("Unhandled exception: %s", exc)
    response = ApiResponse(success=False, error=str(exc))
    return JSONResponse(status_code=500, content=response.model_dump())
