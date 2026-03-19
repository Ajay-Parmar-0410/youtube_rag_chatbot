"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_ENDPOINTS, TIMEOUTS } from "@/lib/constants";
import type { Flashcard, Topic } from "@/types/api";

type TaskStatus = "pending" | "loading" | "complete" | "error";

export interface PrefetchStatus {
  readonly transcript: TaskStatus;
  readonly brief: TaskStatus;
  readonly detailed: TaskStatus;
  readonly flashcards: TaskStatus;
  readonly topics: TaskStatus;
  readonly vectorstore: TaskStatus;
}

export interface PrefetchData {
  readonly brief?: string;
  readonly detailed?: string;
  readonly flashcards?: readonly Flashcard[];
  readonly topics?: readonly Topic[];
}

interface SSEEvent {
  readonly task: string;
  readonly status: string;
  readonly error?: string;
  readonly data?: Record<string, unknown>;
}

const INITIAL_STATUS: PrefetchStatus = {
  transcript: "pending",
  brief: "pending",
  detailed: "pending",
  flashcards: "pending",
  topics: "pending",
  vectorstore: "pending",
};

const INITIAL_DATA: PrefetchData = {};

export function usePrefetch(
  videoId: string,
  language: string,
): {
  status: PrefetchStatus;
  data: PrefetchData;
  fetchedLanguage: string;
} {
  const [status, setStatus] = useState<PrefetchStatus>(INITIAL_STATUS);
  const [data, setData] = useState<PrefetchData>(INITIAL_DATA);
  const [fetchedLanguage, setFetchedLanguage] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const activeVideoRef = useRef<string>("");

  const updateStatus = useCallback(
    (task: string, taskStatus: TaskStatus) => {
      setStatus((prev) => {
        if (!(task in prev)) return prev;
        return { ...prev, [task]: taskStatus };
      });
    },
    [],
  );

  useEffect(() => {
    if (!videoId) {
      setStatus(INITIAL_STATUS);
      setData(INITIAL_DATA);
      return;
    }

    // Don't re-prefetch for the same video + language combo
    const activeKey = `${videoId}:${language}`;
    if (activeVideoRef.current === activeKey) return;
    activeVideoRef.current = activeKey;

    // Abort any previous prefetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset state
    setStatus(INITIAL_STATUS);
    setData(INITIAL_DATA);
    setFetchedLanguage(language);

    async function runPrefetch() {
      try {
        const response = await fetch(API_ENDPOINTS.prefetch, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, language }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(trimmed.slice(6)) as SSEEvent;
              const { task, status: eventStatus, data: eventData } = event;

              if (eventStatus === "started") {
                updateStatus(task, "loading");
              } else if (eventStatus === "complete") {
                updateStatus(task, "complete");

                if (task === "brief" && eventData?.summary) {
                  setData((prev) => ({
                    ...prev,
                    brief: eventData.summary as string,
                  }));
                } else if (task === "detailed" && eventData?.summary) {
                  setData((prev) => ({
                    ...prev,
                    detailed: eventData.summary as string,
                  }));
                } else if (task === "flashcards" && eventData?.flashcards) {
                  setData((prev) => ({
                    ...prev,
                    flashcards: eventData.flashcards as Flashcard[],
                  }));
                } else if (task === "topics" && eventData?.topics) {
                  setData((prev) => ({
                    ...prev,
                    topics: eventData.topics as Topic[],
                  }));
                }
              } else if (eventStatus === "error") {
                updateStatus(task, "error");
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Silently fail — prefetch is best-effort
      }
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, TIMEOUTS.prefetch);

    runPrefetch();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [videoId, language, updateStatus]);

  return { status, data, fetchedLanguage };
}
