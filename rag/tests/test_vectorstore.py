from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

from store_manager import clear_all_stores, clear_store, get_or_create_store, has_store


class TestVectorStore:
    def test_create_vectorstore_with_documents(self):
        """Test that create_vectorstore produces a FAISS instance."""
        with patch("vectorstore.get_embeddings") as mock_emb:
            mock_embeddings = MagicMock()
            mock_embeddings.embed_documents.return_value = [[0.1] * 384]
            mock_embeddings.embed_query.return_value = [0.1] * 384
            mock_emb.return_value = mock_embeddings

            with patch("vectorstore.FAISS.from_documents") as mock_faiss:
                mock_faiss.return_value = MagicMock()

                from vectorstore import create_vectorstore

                docs = [Document(page_content="Test content", metadata={"source": "test"})]
                result = create_vectorstore(docs)

                assert result is not None
                mock_faiss.assert_called_once()

    def test_create_vectorstore_empty_raises(self):
        """Test that empty documents raise ValueError."""
        with patch("vectorstore.get_embeddings") as mock_emb:
            mock_emb.return_value = MagicMock()

            with patch("vectorstore.RecursiveCharacterTextSplitter") as mock_splitter:
                mock_splitter.return_value.split_documents.return_value = []

                from vectorstore import create_vectorstore

                docs = [Document(page_content="", metadata={})]
                with pytest.raises(ValueError, match="No document chunks"):
                    create_vectorstore(docs)

    def test_get_retriever(self):
        """Test retriever creation from vector store."""
        from vectorstore import get_retriever

        mock_store = MagicMock()
        mock_retriever = MagicMock()
        mock_store.as_retriever.return_value = mock_retriever

        result = get_retriever(mock_store, k=3)

        assert result == mock_retriever
        mock_store.as_retriever.assert_called_once_with(search_kwargs={"k": 3})


class TestStoreManager:
    @pytest.fixture(autouse=True)
    def _cleanup(self):
        """Clear all stores before and after each test."""
        clear_all_stores()
        yield
        clear_all_stores()

    @pytest.mark.asyncio()
    async def test_get_or_create_store_creates_new(self):
        with patch("store_manager.create_vectorstore") as mock_create:
            mock_store = MagicMock()
            mock_create.return_value = mock_store

            result = await get_or_create_store("vid1", "some transcript text")

            assert result == mock_store
            mock_create.assert_called_once()

    @pytest.mark.asyncio()
    async def test_get_or_create_store_returns_cached(self):
        with patch("store_manager.create_vectorstore") as mock_create:
            mock_store = MagicMock()
            mock_create.return_value = mock_store

            await get_or_create_store("vid1", "some text")
            result = await get_or_create_store("vid1", "some text")

            assert result == mock_store
            assert mock_create.call_count == 1

    @pytest.mark.asyncio()
    async def test_get_or_create_store_empty_text_raises(self):
        with pytest.raises(ValueError, match="empty"):
            await get_or_create_store("vid1", "   ")

    def test_has_store_false(self):
        assert has_store("nonexistent") is False

    @pytest.mark.asyncio()
    async def test_has_store_true(self):
        with patch("store_manager.create_vectorstore") as mock_create:
            mock_create.return_value = MagicMock()
            await get_or_create_store("vid1", "text")
            assert has_store("vid1") is True

    def test_clear_store(self):
        """Test clearing a specific store."""
        clear_store("nonexistent")  # Should not raise

    @pytest.mark.asyncio()
    async def test_clear_store_removes_entry(self):
        with patch("store_manager.create_vectorstore") as mock_create:
            mock_create.return_value = MagicMock()
            await get_or_create_store("vid1", "text")
            assert has_store("vid1") is True
            clear_store("vid1")
            assert has_store("vid1") is False
