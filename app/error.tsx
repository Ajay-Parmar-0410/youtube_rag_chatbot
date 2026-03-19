"use client";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            className="h-8 w-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-md text-sm text-[var(--muted-foreground)]">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        <button
          onClick={reset}
          className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
