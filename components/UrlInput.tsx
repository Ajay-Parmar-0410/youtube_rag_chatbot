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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
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
          className="flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-all focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
