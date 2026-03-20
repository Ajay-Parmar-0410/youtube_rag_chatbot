"use client";

import { useState, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface FlashCardProps {
  readonly question: string;
  readonly answer: string;
  readonly difficulty: "easy" | "medium" | "hard";
}

const DIFFICULTY_STYLES = {
  easy: "bg-[var(--success)]/15 text-[var(--success)]",
  medium: "bg-[var(--warning)]/15 text-[var(--warning)]",
  hard: "bg-[var(--error)]/15 text-[var(--error)]",
} as const;

export default function FlashCard({
  question,
  answer,
  difficulty,
}: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  return (
    <div
      className="focus-ring perspective-1000 h-56 w-full cursor-pointer select-none rounded-xl"
      onClick={handleFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleFlip();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? "Show question" : "Show answer"}
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front — Question */}
        <div className="absolute inset-0 flex flex-col rounded-xl bg-gradient-to-br from-[var(--card)] to-[var(--card-elevated)] p-5 shadow-sm ring-1 ring-[var(--card-border)] [backface-visibility:hidden]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[var(--accent)] text-xs font-semibold uppercase tracking-wider">
              QUESTION
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${DIFFICULTY_STYLES[difficulty]}`}
            >
              {difficulty}
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm leading-relaxed text-[var(--foreground)]">
              {question}
            </p>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-[var(--muted-foreground)]">
            <RotateCcw size={14} />
            Click to reveal answer
          </p>
        </div>

        {/* Back — Answer */}
        <div className="absolute inset-0 flex flex-col rounded-xl bg-gradient-to-br from-[var(--card)] to-[var(--card-elevated)] p-5 shadow-sm ring-1 ring-[var(--card-border)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="mb-3">
            <span className="text-[var(--accent)] text-xs font-semibold uppercase tracking-wider">
              ANSWER
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm leading-relaxed text-[var(--foreground)]">
              {answer}
            </p>
          </div>
          <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
            Click to see question
          </p>
        </div>
      </div>
    </div>
  );
}
