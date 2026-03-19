"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchTopics } from "@/lib/rag-client";
import type { Topic } from "@/types/api";

interface TopicsListProps {
  readonly videoId: string;
  readonly onSeek?: (seconds: number) => void;
  readonly prefetchedTopics?: readonly Topic[];
  readonly language?: string;
}

interface TopicsState {
  readonly topics: readonly Topic[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

const INITIAL_STATE: TopicsState = {
  topics: [],
  isLoading: false,
  error: null,
};

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TopicsList({ videoId, onSeek, prefetchedTopics, language }: TopicsListProps) {
  const [state, setState] = useState<TopicsState>(INITIAL_STATE);
  const userGeneratedRef = useRef(false);
  const prevLanguageRef = useRef(language);

  // Auto-populate from prefetch data (only if user hasn't manually refreshed)
  useEffect(() => {
    if (
      prefetchedTopics &&
      prefetchedTopics.length > 0 &&
      !userGeneratedRef.current
    ) {
      setState({
        topics: prefetchedTopics,
        isLoading: false,
        error: null,
      });
    }
  }, [prefetchedTopics]);

  // Clear topics when language changes — prefetch will provide new data
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      if (state.topics.length > 0) {
        userGeneratedRef.current = false;
        setState(INITIAL_STATE);
      }
    }
  }, [language, state.topics.length]);

  const extractTopics = useCallback(async () => {
    userGeneratedRef.current = true;
    if (!videoId) return;

    setState({ topics: [], isLoading: true, error: null });

    const langParam = language && language !== "English" ? language : undefined;
    const result = await fetchTopics(videoId, langParam);

    if (result.success && result.data) {
      setState({
        topics: result.data.topics,
        isLoading: false,
        error: null,
      });
    } else {
      setState({
        topics: [],
        isLoading: false,
        error: result.error ?? "Failed to extract topics.",
      });
    }
  }, [videoId, language]);

  const handleTimestampClick = useCallback(
    (seconds: number) => {
      onSeek?.(seconds);
    },
    [onSeek],
  );

  if (!videoId) {
    return (
      <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Key Topics
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to extract key topics.
        </p>
      </div>
    );
  }

  const hasTopics = state.topics.length > 0;

  return (
    <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Key Topics
        </h2>
        <button
          onClick={extractTopics}
          disabled={state.isLoading}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {state.isLoading
            ? "Extracting..."
            : hasTopics
              ? "Refresh"
              : "Extract Topics"}
        </button>
      </div>

      {state.isLoading && (
        <div className="flex h-40 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              Extracting key topics...
            </p>
          </div>
        </div>
      )}

      {state.error && !state.isLoading && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {state.error}
          </p>
          <button
            onClick={extractTopics}
            className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {!hasTopics && !state.isLoading && !state.error && (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Click &quot;Extract Topics&quot; to identify key topics in the
            video.
          </p>
        </div>
      )}

      {hasTopics && !state.isLoading && (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {state.topics.map((topic, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-[var(--surface)] p-3 ring-1 ring-[var(--card-border)] transition-colors hover:bg-[var(--muted)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {topic.topic}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {topic.description}
                  </p>
                </div>
                <button
                  onClick={() => handleTimestampClick(topic.timestamp_start)}
                  className="shrink-0 rounded-md bg-[var(--accent)]/10 px-2 py-1 text-xs font-mono font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
                  title={`Jump to ${formatTimestamp(topic.timestamp_start)}`}
                >
                  {formatTimestamp(topic.timestamp_start)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
