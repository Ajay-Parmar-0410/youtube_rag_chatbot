from __future__ import annotations

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import get_settings
from embeddings import get_embeddings


def create_vectorstore(documents: list[Document]) -> FAISS:
    """Create a FAISS vector store from documents.

    Splits documents into chunks before embedding.
    """
    settings = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(documents)

    if not chunks:
        raise ValueError("No document chunks produced after splitting")

    embeddings = get_embeddings()
    return FAISS.from_documents(chunks, embeddings)


def get_retriever(vectorstore: FAISS, k: int = 4) -> VectorStoreRetriever:
    """Create a retriever from a FAISS vector store."""
    settings = get_settings()
    effective_k = k if k > 0 else settings.RETRIEVAL_K
    return vectorstore.as_retriever(search_kwargs={"k": effective_k})
