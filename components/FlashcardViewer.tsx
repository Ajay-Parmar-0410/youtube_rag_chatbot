"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { fetchFlashcards } from "@/lib/rag-client";
import type { Flashcard } from "@/types/api";
import FlashCard from "@/components/FlashCard";

interface FlashcardViewerProps {
  readonly videoId: string;
  readonly prefetchedFlashcards?: readonly Flashcard[];
  readonly language?: string;
}

interface FlashcardState {
  readonly flashcards: readonly Flashcard[];
  readonly currentIndex: number;
  readonly isLoading: boolean;
  readonly error: string | null;
}

const INITIAL_STATE: FlashcardState = {
  flashcards: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
};

export default function FlashcardViewer({ videoId, prefetchedFlashcards, language }: FlashcardViewerProps) {
  const [state, setState] = useState<FlashcardState>(INITIAL_STATE);
  const userGeneratedRef = useRef(false);
  const prevLanguageRef = useRef(language);

  // Auto-populate from prefetch data (only if user hasn't manually regenerated)
  useEffect(() => {
    if (
      prefetchedFlashcards &&
      prefetchedFlashcards.length > 0 &&
      !userGeneratedRef.current
    ) {
      setState({
        flashcards: prefetchedFlashcards,
        currentIndex: 0,
        isLoading: false,
        error: null,
      });
    }
  }, [prefetchedFlashcards]);

  // Clear flashcards when language changes — prefetch will provide new data
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      if (state.flashcards.length > 0) {
        userGeneratedRef.current = false;
        setState(INITIAL_STATE);
      }
    }
  }, [language, state.flashcards.length]);

  const generateFlashcards = useCallback(async () => {
    userGeneratedRef.current = true;
    if (!videoId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const langParam = language && language !== "English" ? language : undefined;
    const result = await fetchFlashcards(videoId, 10, langParam);

    if (result.success && result.data) {
      setState({
        flashcards: result.data.flashcards,
        currentIndex: 0,
        isLoading: false,
        error: null,
      });
    } else {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: result.error ?? "Failed to generate flashcards.",
      }));
    }
  }, [videoId, language]);

  const goToCard = useCallback((index: number) => {
    setState((prev) => ({ ...prev, currentIndex: index }));
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, prev.flashcards.length - 1),
    }));
  }, []);

  const goPrev = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, 0),
    }));
  }, []);

  const shuffle = useCallback(() => {
    setState((prev) => {
      const shuffled = [...prev.flashcards].sort(() => Math.random() - 0.5);
      return { ...prev, flashcards: shuffled, currentIndex: 0 };
    });
  }, []);

  if (!videoId) {
    return (
      <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Flashcards
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to generate flashcards.
        </p>
      </div>
    );
  }

  const currentCard = state.flashcards[state.currentIndex];
  const hasCards = state.flashcards.length > 0;

  return (
    <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Flashcards
        </h2>
        <div className="flex items-center gap-2">
          {hasCards && (
            <button
              onClick={shuffle}
              className="focus-ring rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5"
              title="Shuffle cards"
              aria-label="Shuffle cards"
            >
              <Shuffle size={16} />
              Shuffle
            </button>
          )}
          <button
            onClick={generateFlashcards}
            disabled={state.isLoading}
            className="btn-press focus-ring rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {state.isLoading ? (
              "Generating..."
            ) : hasCards ? (
              <>
                <Sparkles size={16} />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {state.isLoading && (
        <div className="flex h-56 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              Generating flashcards from video...
            </p>
          </div>
        </div>
      )}

      {state.error && !state.isLoading && (
        <div className="fade-in rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {state.error}
          </p>
          <button
            onClick={generateFlashcards}
            className="focus-ring mt-2 text-sm font-medium text-red-600 underline transition-colors duration-150 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {!hasCards && !state.isLoading && !state.error && (
        <div className="fade-in flex h-56 items-center justify-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Click &quot;Generate&quot; to create flashcards from the video
            content.
          </p>
        </div>
      )}

      {hasCards && !state.isLoading && currentCard && (
        <div className="fade-in">
          <FlashCard
            key={state.currentIndex}
            question={currentCard.question}
            answer={currentCard.answer}
            difficulty={currentCard.difficulty}
          />

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={state.currentIndex === 0}
              className="focus-ring rounded-lg p-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--muted)] disabled:opacity-30"
              aria-label="Previous card"
            >
              <ChevronLeft size={20} />
            </button>

            <span className="text-sm font-medium text-[var(--muted-foreground)]">
              {state.currentIndex + 1} of {state.flashcards.length}
            </span>

            <button
              onClick={goNext}
              disabled={state.currentIndex === state.flashcards.length - 1}
              className="focus-ring rounded-lg p-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--muted)] disabled:opacity-30"
              aria-label="Next card"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
