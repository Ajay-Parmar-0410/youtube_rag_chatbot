"use client";

import { useState, useCallback, type FormEvent } from "react";
import { validateYouTubeUrl } from "@/lib/validation";

interface UrlInputProps {
  readonly onSubmit: (videoId: string) => void;
  readonly isLoading?: boolean;
}

export default function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      const result = validateYouTubeUrl(url);
      if (!result.valid) {
        setError(result.error ?? "Invalid URL");
        return;
      }

      setError(null);
      onSubmit(result.videoId!);
    },
    [url, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 shadow-lg shadow-black/5">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste a YouTube URL..."
          disabled={isLoading}
          className="focus-ring flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-6 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-all duration-150 focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="btn-press focus-ring rounded-full bg-[var(--accent)] px-8 py-3.5 text-base font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Load"}
        </button>
      </div>
      {error && (
        <p className="pl-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
