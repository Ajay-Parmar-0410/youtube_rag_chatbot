"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { fetchSummary, fetchTranscript } from "@/lib/rag-client";

interface SummaryViewProps {
  readonly videoId: string;
}

type ViewMode = "brief" | "detailed" | "transcript";

interface ContentCache {
  readonly brief: string | null;
  readonly detailed: string | null;
  readonly transcript: string | null;
}

interface SummaryState {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly mode: ViewMode;
}

const EMPTY_CACHE: ContentCache = {
  brief: null,
  detailed: null,
  transcript: null,
};

export default function SummaryView({ videoId }: SummaryViewProps) {
  const [state, setState] = useState<SummaryState>({
    isLoading: false,
    error: null,
    mode: "brief",
  });
  const [cache, setCache] = useState<ContentCache>(EMPTY_CACHE);
  const cachedVideoId = useRef<string>("");

  const loadContent = useCallback(
    async (mode: ViewMode) => {
      if (!videoId) return;

      if (cache[mode] !== null && cachedVideoId.current === videoId) {
        setState((prev) => ({ ...prev, mode, error: null }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null, mode }));

      if (mode === "transcript") {
        const result = await fetchTranscript(videoId);
        if (result.success && result.data) {
          const formatted = result.data.segments
            .map((seg) => {
              const mins = Math.floor(seg.start / 60);
              const secs = Math.floor(seg.start % 60);
              const ts = `${mins}:${secs.toString().padStart(2, "0")}`;
              return `**[${ts}]** ${seg.text}`;
            })
            .join("\n\n");
          setCache((prev) => ({ ...prev, transcript: formatted }));
          setState((prev) => ({ ...prev, isLoading: false }));
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error ?? "Failed to load transcript.",
            isLoading: false,
          }));
        }
      } else {
        const result = await fetchSummary(videoId, mode);
        if (result.success && result.data) {
          setCache((prev) => ({ ...prev, [mode]: result.data!.summary }));
          setState((prev) => ({ ...prev, isLoading: false }));
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error ?? "Failed to load summary.",
            isLoading: false,
          }));
        }
      }
    },
    [videoId, cache],
  );

  useEffect(() => {
    if (videoId && videoId !== cachedVideoId.current) {
      cachedVideoId.current = videoId;
      setCache(EMPTY_CACHE);
      setState({ isLoading: false, error: null, mode: "brief" });
      loadContent("brief");
    } else if (!videoId) {
      cachedVideoId.current = "";
      setCache(EMPTY_CACHE);
      setState({ isLoading: false, error: null, mode: "brief" });
    }
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentContent = cache[state.mode];

  if (!videoId) {
    return (
      <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Summary
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to see its summary.
        </p>
      </div>
    );
  }

  const tabs: { label: string; value: ViewMode }[] = [
    { label: "Brief", value: "brief" },
    { label: "Detailed", value: "detailed" },
    { label: "Transcript", value: "transcript" },
  ];

  return (
    <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {state.mode === "transcript" ? "Transcript" : "Summary"}
        </h2>
        <div className="flex gap-0.5 rounded-full bg-[var(--muted)] p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => loadContent(tab.value)}
              disabled={state.isLoading}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                state.mode === tab.value
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {state.isLoading && (
        <div className="animate-pulse space-y-2.5">
          <div className="h-3.5 w-full rounded-full bg-[var(--muted)]" />
          <div className="h-3.5 w-5/6 rounded-full bg-[var(--muted)]" />
          <div className="h-3.5 w-4/6 rounded-full bg-[var(--muted)]" />
          <div className="h-3.5 w-full rounded-full bg-[var(--muted)]" />
          <div className="h-3.5 w-3/6 rounded-full bg-[var(--muted)]" />
        </div>
      )}

      {state.error && !state.isLoading && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {state.error}
          </p>
          <button
            onClick={() => {
              setCache((prev) => ({ ...prev, [state.mode]: null }));
              loadContent(state.mode);
            }}
            className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {currentContent && !state.isLoading && !state.error && (
        <div
          className={`prose prose-sm max-w-none text-[var(--foreground)] prose-headings:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-p:text-[var(--foreground)] dark:prose-invert ${
            state.mode === "transcript" ? "max-h-96 overflow-y-auto" : ""
          }`}
        >
          <ReactMarkdown>{currentContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
