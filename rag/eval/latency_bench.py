"""End-to-end Q&A latency benchmark for the YouTube RAG pipeline.

Measures total time from question to generated answer across a grid of
``chunk_size`` x ``k`` configurations. End-to-end latency captures the real
user-facing cost:

    embed_query  +  FAISS search  +  LLM generation over k retrieved chunks

Retrieval cost is dominated by the single query-embedding API call
(FAISS search itself is sub-millisecond). Generation cost scales with
the amount of context handed to the LLM — so smaller k and larger
chunks (fewer total retrieved tokens for the same information coverage)
typically translate to faster end-to-end responses.

Usage:
    cd rag
    python -m eval.latency_bench
    python -m eval.latency_bench --warmup 2 --trials 5
    python -m eval.latency_bench --videos aircAruvnKk LPZh9BOjkQs
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

# Allow running as `python -m eval.latency_bench` from rag/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from chain import create_qa_chain
from embeddings import get_embeddings

from eval.dataset import EVAL_DATASET
from eval.transcript_cache import fetch_or_load

DEFAULT_CHUNK_SIZES = (500, 1000, 1500)
DEFAULT_KS = (3, 5, 8)


@dataclass(frozen=True)
class LatencyResult:
    """Aggregated latency metrics for a single (chunk_size, k) config."""

    chunk_size: int
    chunk_overlap: int
    retrieval_k: int
    trials: int
    p50_ms: float
    p95_ms: float
    mean_ms: float
    min_ms: float
    max_ms: float


@dataclass(frozen=True)
class BenchSummary:
    """Full benchmark result set, plus computed baseline-vs-best delta."""

    results: list[LatencyResult]
    baseline_config: str
    best_config: str
    p95_reduction_pct: float


def _build_store(text: str, chunk_size: int, chunk_overlap: int) -> FAISS:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents([Document(page_content=text)])
    return FAISS.from_documents(chunks, get_embeddings())


def _percentile(values: list[float], pct: float) -> float:
    """Linear-interpolated percentile (pct in [0, 100])."""
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * (pct / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    frac = k - lo
    return s[lo] + (s[hi] - s[lo]) * frac


async def _bench_one_config(
    stores: list[tuple[FAISS, list[str]]],
    chunk_size: int,
    chunk_overlap: int,
    k: int,
    warmup: int,
    trials: int,
) -> LatencyResult:
    """Time end-to-end Q&A across all (store, question) pairs for one config."""
    samples_ms: list[float] = []

    for store, questions in stores:
        retriever = store.as_retriever(search_kwargs={"k": k})
        chain = create_qa_chain(retriever)

        # Warmup — excluded from measurements to avoid cold-start skew
        for _ in range(warmup):
            await chain.ainvoke(questions[0])

        for _ in range(trials):
            for q in questions:
                start = time.perf_counter()
                await chain.ainvoke(q)
                samples_ms.append((time.perf_counter() - start) * 1000.0)

    return LatencyResult(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        retrieval_k=k,
        trials=len(samples_ms),
        p50_ms=_percentile(samples_ms, 50),
        p95_ms=_percentile(samples_ms, 95),
        mean_ms=statistics.mean(samples_ms),
        min_ms=min(samples_ms),
        max_ms=max(samples_ms),
    )


async def run_bench(
    chunk_sizes: tuple[int, ...],
    ks: tuple[int, ...],
    chunk_overlap: int,
    warmup: int,
    trials: int,
    refresh: bool,
    max_chars: int | None = None,
    cooldown_s: float = 0.0,
    only_videos: tuple[str, ...] | None = None,
) -> BenchSummary:
    """Run the full grid of (chunk_size x k) configs and compute baseline vs best.

    Args:
        max_chars: Truncate transcripts longer than this (free-tier rate limits).
        cooldown_s: Seconds to sleep between chunk_size iterations to stay under
            per-minute embedding API quotas.
        only_videos: Restrict to these video IDs (useful for tight rate limits).
    """
    videos = EVAL_DATASET
    if only_videos:
        videos = tuple(v for v in videos if v.video_id in set(only_videos))

    # Preload transcripts + questions once
    video_data: list[tuple[str, list[str]]] = []
    for v in videos:
        try:
            text = await fetch_or_load(v.video_id, refresh=refresh)
            if max_chars is not None and len(text) > max_chars:
                text = text[:max_chars]
            video_data.append((text, [q.question for q in v.questions]))
        except Exception as exc:
            print(f"[bench] SKIPPED {v.video_id}: {exc}")

    if not video_data:
        raise RuntimeError("No transcripts available for benchmarking")

    results: list[LatencyResult] = []
    try:
        for i, chunk_size in enumerate(chunk_sizes):
            if i > 0 and cooldown_s > 0:
                print(f"[bench] cooldown {cooldown_s:.0f}s before chunk_size={chunk_size}")
                await asyncio.sleep(cooldown_s)
            # Rebuild FAISS stores once per chunk_size (expensive), reuse across k values
            stores: list[tuple[FAISS, list[str]]] = []
            for vi, (text, questions) in enumerate(video_data):
                if vi > 0 and cooldown_s > 0:
                    # Spread ingest embeddings across the rate-limit window
                    await asyncio.sleep(cooldown_s / len(video_data))
                stores.append((_build_store(text, chunk_size, chunk_overlap), questions))

            for k in ks:
                print(f"[bench] chunk_size={chunk_size} k={k} …")
                result = await _bench_one_config(
                    stores, chunk_size, chunk_overlap, k, warmup, trials
                )
                print(
                    f"  p50={result.p50_ms:.1f}ms  p95={result.p95_ms:.1f}ms  "
                    f"mean={result.mean_ms:.1f}ms  (n={result.trials})"
                )
                results.append(result)
    except Exception as exc:
        print(f"[bench] aborted after {len(results)} configs: {exc}")
        if not results:
            raise

    # Baseline: smallest chunks + largest k (most work per query)
    # Best: lowest p95
    baseline = max(results, key=lambda r: (r.retrieval_k, -r.chunk_size))
    best = min(results, key=lambda r: r.p95_ms)
    p95_reduction = (
        (baseline.p95_ms - best.p95_ms) / baseline.p95_ms * 100.0
        if baseline.p95_ms > 0
        else 0.0
    )

    return BenchSummary(
        results=results,
        baseline_config=f"chunk_size={baseline.chunk_size},k={baseline.retrieval_k}",
        best_config=f"chunk_size={best.chunk_size},k={best.retrieval_k}",
        p95_reduction_pct=p95_reduction,
    )


def _print_table(summary: BenchSummary) -> None:
    """Print a grid summary to stdout."""
    print()
    print("=" * 72)
    print(f"{'chunk_size':>10} | {'k':>3} | {'p50 (ms)':>9} | {'p95 (ms)':>9} | {'mean (ms)':>9}")
    print("-" * 72)
    for r in summary.results:
        print(
            f"{r.chunk_size:>10} | {r.retrieval_k:>3} | "
            f"{r.p50_ms:>9.1f} | {r.p95_ms:>9.1f} | {r.mean_ms:>9.1f}"
        )
    print("=" * 72)
    print(f"Baseline: {summary.baseline_config}")
    print(f"Best:     {summary.best_config}")
    print(f"P95 latency reduction (best vs baseline): {summary.p95_reduction_pct:.1f}%")


def _save_results(summary: BenchSummary, path: Path) -> None:
    payload = {
        "results": [asdict(r) for r in summary.results],
        "baseline_config": summary.baseline_config,
        "best_config": summary.best_config,
        "p95_reduction_pct": summary.p95_reduction_pct,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[bench] wrote {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark retrieval latency.")
    parser.add_argument(
        "--chunk-sizes",
        type=int,
        nargs="+",
        default=list(DEFAULT_CHUNK_SIZES),
    )
    parser.add_argument("--ks", type=int, nargs="+", default=list(DEFAULT_KS))
    parser.add_argument("--chunk-overlap", type=int, default=200)
    parser.add_argument("--warmup", type=int, default=2)
    parser.add_argument("--trials", type=int, default=10)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=None,
        help="Truncate transcripts longer than this (free-tier rate limits).",
    )
    parser.add_argument(
        "--cooldown",
        type=float,
        default=0.0,
        help="Seconds to sleep between chunk_size iterations.",
    )
    parser.add_argument(
        "--videos",
        type=str,
        nargs="+",
        default=None,
        help="Restrict to these video IDs (useful for tight rate limits).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results_latency.json",
    )
    args = parser.parse_args()

    summary = asyncio.run(
        run_bench(
            tuple(args.chunk_sizes),
            tuple(args.ks),
            args.chunk_overlap,
            args.warmup,
            args.trials,
            args.refresh,
            max_chars=args.max_chars,
            cooldown_s=args.cooldown,
            only_videos=tuple(args.videos) if args.videos else None,
        )
    )
    _print_table(summary)
    _save_results(summary, args.output)


if __name__ == "__main__":
    main()
