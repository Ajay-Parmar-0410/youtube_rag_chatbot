---
description: RAG pipeline architecture, chain pattern, and prompt template
paths: ["rag/**", "*.py"]
---

# RAG Pipeline (LangChain + LangGraph)

## Flow

1. User pastes YouTube URL
2. Extract transcript via `YoutubeLoader` / `youtube-transcript-api`
3. Chunk transcript with `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200)
4. Generate embeddings via `HuggingFaceEmbeddings` and store in FAISS
5. Retrieve top-k relevant chunks (k=4, similarity search)
6. Augment prompt with retrieved context + user question
7. Generate answer via LLM (Groq ChatModel)
8. LangGraph manages workflow state (retrieval -> relevance grading -> generation -> hallucination check)

## Chain Architecture

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

def format_docs(retrieved_docs):
    return "\n\n".join(doc.page_content for doc in retrieved_docs)

parallel_chain = RunnableParallel({
    "context": retriever | RunnableLambda(format_docs),
    "question": RunnablePassthrough()
})
main_chain = parallel_chain | prompt | model | StrOutputParser()
```

## Prompt Template

```
You are a helpful assistant.
Answer ONLY from the provided transcript context.
If the context is insufficient, just say you don't know.

Context: {context}
Question: {question}
```

## Existing Code Reference

- Prior LangChain notebook: `C:\Users\Dell\Downloads\Youtube_Chatbot`
- Working features to port: transcript loading, text splitting, FAISS indexing, retriever, RunnableParallel chain
- Upgrade: replace HuggingFace Inference LLM with Groq ChatModel for faster responses
