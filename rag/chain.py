from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableParallel, RunnablePassthrough
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

from config import get_settings
from prompts import (
    MULTILINGUAL_QA_PROMPT,
    MULTILINGUAL_SUMMARY_BRIEF_PROMPT,
    MULTILINGUAL_SUMMARY_DETAILED_PROMPT,
    QA_PROMPT,
    SUMMARY_BRIEF_PROMPT,
    SUMMARY_DETAILED_PROMPT,
)


def _get_groq_llm(lightweight: bool = False) -> ChatGroq:
    """Create a ChatGroq LLM instance.

    Args:
        lightweight: Use the lightweight model (8b) for higher rate limits.
    """
    settings = get_settings()
    model = settings.LIGHTWEIGHT_MODEL if lightweight else settings.MODEL_NAME
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.3,
    )


def _get_gemini_llm(api_key: str | None = None) -> ChatGoogleGenerativeAI:
    """Create a Gemini LLM instance for summarization.

    Args:
        api_key: Specific API key to use. Defaults to GOOGLE_API_KEY.
    """
    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=api_key or settings.GOOGLE_API_KEY,
        temperature=0.3,
    )


def format_docs(docs: list[Document]) -> str:
    """Format retrieved documents into a single string."""
    return "\n\n".join(doc.page_content for doc in docs)


def create_qa_chain(
    retriever: VectorStoreRetriever,
    language: str | None = None,
    lightweight: bool = False,
    chat_history: list[tuple[str, str]] | None = None,
) -> Runnable:
    """Create a RAG Q&A chain using LCEL.

    Uses Groq for Q&A (small inputs, fast responses).
    When language is specified, responses are in that language.

    Args:
        lightweight: Use the 8b model (for rate limit fallback).
        chat_history: List of (role, content) tuples for conversation context.
    """
    llm = _get_groq_llm(lightweight=lightweight)
    prompt = MULTILINGUAL_QA_PROMPT if language else QA_PROMPT
    history = chat_history or []

    if language:
        context_and_question = RunnableParallel(
            context=retriever | format_docs,
            question=RunnablePassthrough(),
            language=lambda _: language,
            chat_history=lambda _: history,
        )
    else:
        context_and_question = RunnableParallel(
            context=retriever | format_docs,
            question=RunnablePassthrough(),
            chat_history=lambda _: history,
        )

    return context_and_question | prompt | llm | StrOutputParser()


def create_summary_chain(
    mode: str = "brief",
    language: str | None = None,
    force_groq: bool = False,
    gemini_api_key: str | None = None,
) -> Runnable:
    """Create a summary chain.

    Uses Gemini for summarization (high RPM, large context window).
    Falls back to Groq lightweight if Gemini is not configured or force_groq=True.
    When language is specified, summaries are in that language.

    Args:
        gemini_api_key: Use a specific Gemini key (for parallel prefetch).
    """
    settings = get_settings()
    use_gemini = (
        not force_groq
        and mode == "detailed"
        and settings.GOOGLE_API_KEY != "placeholder-will-be-replaced"
    )
    if use_gemini:
        llm = _get_gemini_llm(api_key=gemini_api_key)
    else:
        # force_groq=True means fallback from a rate limit — use 8b
        # Otherwise try 70b for better language adherence
        llm = _get_groq_llm(lightweight=force_groq)

    # Always use multilingual prompt with explicit language to ensure
    # the LLM responds in the correct language even when the transcript
    # is in a different language (e.g. Hindi transcript → English summary).
    prompt = (
        MULTILINGUAL_SUMMARY_BRIEF_PROMPT
        if mode == "brief"
        else MULTILINGUAL_SUMMARY_DETAILED_PROMPT
    )

    return prompt | llm | StrOutputParser()
