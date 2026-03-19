from __future__ import annotations

from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

from chain import create_qa_chain, create_summary_chain, format_docs
from prompts import QA_PROMPT, SUMMARY_BRIEF_PROMPT, SUMMARY_DETAILED_PROMPT


class TestFormatDocs:
    def test_format_docs_single(self):
        docs = [Document(page_content="Hello world")]
        result = format_docs(docs)
        assert result == "Hello world"

    def test_format_docs_multiple(self):
        docs = [
            Document(page_content="First chunk"),
            Document(page_content="Second chunk"),
            Document(page_content="Third chunk"),
        ]
        result = format_docs(docs)
        assert result == "First chunk\n\nSecond chunk\n\nThird chunk"

    def test_format_docs_empty(self):
        result = format_docs([])
        assert result == ""


class TestPrompts:
    def test_qa_prompt_has_context_and_question(self):
        variables = QA_PROMPT.input_variables
        assert "context" in variables
        assert "question" in variables

    def test_summary_brief_prompt_has_transcript(self):
        variables = SUMMARY_BRIEF_PROMPT.input_variables
        assert "transcript" in variables

    def test_summary_detailed_prompt_has_transcript(self):
        variables = SUMMARY_DETAILED_PROMPT.input_variables
        assert "transcript" in variables


class TestCreateQAChain:
    def test_create_qa_chain_returns_runnable(self):
        with patch("chain._get_llm") as mock_llm:
            mock_llm.return_value = MagicMock()
            mock_retriever = MagicMock()
            chain = create_qa_chain(mock_retriever)
            assert chain is not None

    def test_create_qa_chain_uses_retriever(self):
        with patch("chain._get_llm") as mock_llm:
            mock_llm.return_value = MagicMock()
            mock_retriever = MagicMock()
            chain = create_qa_chain(mock_retriever)
            # Chain should be composable (has invoke method pattern)
            assert hasattr(chain, "invoke") or hasattr(chain, "ainvoke")


class TestCreateSummaryChain:
    def test_create_summary_chain_brief(self):
        with patch("chain._get_llm") as mock_llm:
            mock_llm.return_value = MagicMock()
            chain = create_summary_chain(mode="brief")
            assert chain is not None
            mock_llm.assert_called_once_with(lightweight=True)

    def test_create_summary_chain_detailed(self):
        with patch("chain._get_llm") as mock_llm:
            mock_llm.return_value = MagicMock()
            chain = create_summary_chain(mode="detailed")
            assert chain is not None
            mock_llm.assert_called_once_with(lightweight=False)
