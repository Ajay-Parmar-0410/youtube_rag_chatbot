"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="fade-in flex min-h-[60vh] items-center justify-center px-4">
      <div className="rounded-xl bg-[var(--card)] p-8 text-center ring-1 ring-[var(--card-border)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--error)]/10">
          <AlertTriangle size={32} className="text-[var(--error)]" />
        </div>

        <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-md text-sm text-[var(--muted-foreground)]">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        <button
          onClick={reset}
          className="btn-press focus-ring rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
