"""Retrieval accuracy evaluation for the YouTube RAG pipeline.

Builds a FAISS vector store per video using the same chunking and embedding
pipeline as production, runs each labeled question, and measures:

  - hit@1, hit@3, hit@5  (fraction of queries where the correct chunk is in top-k)
  - MRR                  (mean reciprocal rank, up to rank 10)

A retrieval is a "hit" at rank k if any of the top-k chunks contains the
question's ``expected_substring`` (case-insensitive).

Usage:
    # From the rag/ directory (so imports resolve):
    cd rag
    python -m eval.retrieval_eval
    python -m eval.retrieval_eval --chunk-size 1500 --chunk-overlap 300
    python -m eval.retrieval_eval --refresh     # re-fetch transcripts
    python -m eval.retrieval_eval --output results.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

# Allow running as `python -m eval.retrieval_eval` from rag/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from embeddings import get_embeddings

from eval.dataset import EVAL_DATASET, EvalQuestion, total_questions
from eval.transcript_cache import fetch_or_load


@dataclass(frozen=True)
class QueryResult:
    """Outcome of evaluating a single question."""

    video_id: str
    question: str
    expected_substring: str
    rank: int | None  # 1-indexed rank of first hit, None if miss
    hit_at_1: bool
    hit_at_3: bool
    hit_at_5: bool


@dataclass(frozen=True)
class EvalSummary:
    """Aggregated results across the full dataset."""

    chunk_size: int
    chunk_overlap: int
    retrieval_k: int
    total_queries: int
    hit_at_1: float
    hit_at_3: float
    hit_at_5: float
    mrr: float
    per_query: list[QueryResult]


def _build_store(
    full_text: str,
    chunk_size: int,
    chunk_overlap: int,
) -> FAISS:
    """Build a FAISS store from a raw transcript with the given chunking params."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents([Document(page_content=full_text)])
    if not chunks:
        raise ValueError("Splitter produced no chunks")
    return FAISS.from_documents(chunks, get_embeddings())


def _first_hit_rank(
    retrieved: list[Document],
    expected_substring: str,
) -> int | None:
    """Return the 1-indexed rank of the first chunk containing the substring."""
    needle = expected_substring.lower()
    for i, doc in enumerate(retrieved, start=1):
        if needle in doc.page_content.lower():
            return i
    return None


async def _evaluate_video(
    video_id: str,
    questions: tuple[EvalQuestion, ...],
    chunk_size: int,
    chunk_overlap: int,
    k: int,
    refresh: bool,
    max_chars: int | None = None,
) -> list[QueryResult]:
    """Evaluate all questions for a single video.

    Args:
        max_chars: If set, truncate transcripts longer than this. Used to keep
            very long videos under free-tier embedding API rate limits.
    """
    transcript = await fetch_or_load(video_id, refresh=refresh)
    if max_chars is not None and len(transcript) > max_chars:
        print(f"[eval] truncating {video_id} from {len(transcript)} to {max_chars} chars")
        transcript = transcript[:max_chars]
    store = _build_store(transcript, chunk_size, chunk_overlap)
    retriever = store.as_retriever(search_kwargs={"k": max(k, 10)})

    results: list[QueryResult] = []
    for q in questions:
        docs = await retriever.ainvoke(q.question)
        rank = _first_hit_rank(docs, q.expected_substring)
        results.append(
            QueryResult(
                video_id=video_id,
                question=q.question,
                expected_substring=q.expected_substring,
                rank=rank,
                hit_at_1=rank is not None and rank <= 1,
                hit_at_3=rank is not None and rank <= 3,
                hit_at_5=rank is not None and rank <= 5,
            )
        )
    return results


def _summarize(
    per_query: list[QueryResult],
    chunk_size: int,
    chunk_overlap: int,
    k: int,
) -> EvalSummary:
    """Aggregate hit rates and MRR across all query results."""
    n = len(per_query)
    if n == 0:
        return EvalSummary(chunk_size, chunk_overlap, k, 0, 0.0, 0.0, 0.0, 0.0, [])

    h1 = sum(1 for r in per_query if r.hit_at_1) / n
    h3 = sum(1 for r in per_query if r.hit_at_3) / n
    h5 = sum(1 for r in per_query if r.hit_at_5) / n
    mrr = sum(1.0 / r.rank for r in per_query if r.rank is not None) / n

    return EvalSummary(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        retrieval_k=k,
        total_queries=n,
        hit_at_1=h1,
        hit_at_3=h3,
        hit_at_5=h5,
        mrr=mrr,
        per_query=per_query,
    )


async def run_eval(
    chunk_size: int,
    chunk_overlap: int,
    k: int,
    refresh: bool,
    cooldown_s: float = 0.0,
    max_chars: int | None = None,
) -> EvalSummary:
    """Evaluate the full dataset and return aggregated results.

    Args:
        cooldown_s: Seconds to sleep between videos. Use to stay under per-minute
            embedding API rate limits on free-tier keys.
        max_chars: If set, truncate transcripts longer than this (see
            ``_evaluate_video``).
    """
    all_results: list[QueryResult] = []
    for i, video in enumerate(EVAL_DATASET):
        if i > 0 and cooldown_s > 0:
            print(f"[eval] cooldown {cooldown_s:.0f}s")
            await asyncio.sleep(cooldown_s)
        print(f"[eval] video={video.video_id} ({video.title})")
        try:
            video_results = await _evaluate_video(
                video.video_id,
                video.questions,
                chunk_size,
                chunk_overlap,
                k,
                refresh,
                max_chars=max_chars,
            )
        except Exception as exc:
            print(f"[eval] SKIPPED {video.video_id}: {exc}")
            continue
        for r in video_results:
            mark = "HIT" if r.hit_at_3 else "miss"
            rank_str = str(r.rank) if r.rank is not None else "-"
            print(f"  [{mark}] rank={rank_str} q={r.question!r}")
        all_results.extend(video_results)

    return _summarize(all_results, chunk_size, chunk_overlap, k)


def _print_summary(summary: EvalSummary) -> None:
    """Print a human-readable summary table to stdout."""
    print()
    print("=" * 64)
    print(
        f"Config: chunk_size={summary.chunk_size}, "
        f"overlap={summary.chunk_overlap}, k={summary.retrieval_k}"
    )
    print(f"Total queries: {summary.total_queries} / {total_questions()} labeled")
    print(f"hit@1 : {summary.hit_at_1:.1%}")
    print(f"hit@3 : {summary.hit_at_3:.1%}")
    print(f"hit@5 : {summary.hit_at_5:.1%}")
    print(f"MRR   : {summary.mrr:.3f}")
    print("=" * 64)


def _save_results(summary: EvalSummary, path: Path) -> None:
    """Persist summary as JSON (dataclasses → dicts)."""
    payload = asdict(summary)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[eval] wrote {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate retrieval accuracy.")
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--chunk-overlap", type=int, default=200)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument(
        "--refresh", action="store_true", help="Bypass transcript cache"
    )
    parser.add_argument(
        "--cooldown",
        type=float,
        default=0.0,
        help="Seconds to sleep between videos (use to stay under rate limits).",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=None,
        help="Truncate transcripts longer than this (keeps long videos under rate limits).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results_retrieval.json",
        help="Where to write the results JSON",
    )
    args = parser.parse_args()

    summary = asyncio.run(
        run_eval(
            args.chunk_size,
            args.chunk_overlap,
            args.k,
            args.refresh,
            cooldown_s=args.cooldown,
            max_chars=args.max_chars,
        )
    )
    _print_summary(summary)
    _save_results(summary, args.output)


if __name__ == "__main__":
    main()
