"use client";

import { useState, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import type { TranscriptSegment } from "@/types/api";

interface TranscriptViewerProps {
  readonly segments: readonly TranscriptSegment[];
  readonly onSeek?: (seconds: number) => void;
  readonly currentTime?: number;
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TranscriptViewer({
  segments,
  onSeek,
  currentTime = 0,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [],
  );

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase();
    return segments.filter((seg) => seg.text.toLowerCase().includes(query));
  }, [segments, searchQuery]);

  const activeSegmentIndex = useMemo(() => {
    if (currentTime <= 0) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start <= currentTime) return i;
    }
    return -1;
  }, [segments, currentTime]);

  const handleSegmentClick = useCallback(
    (seconds: number) => {
      onSeek?.(seconds);
    },
    [onSeek],
  );

  const highlightMatch = useCallback(
    (text: string): React.ReactNode => {
      if (!searchQuery.trim()) return text;
      const query = searchQuery.toLowerCase();
      const lowerText = text.toLowerCase();
      const idx = lowerText.indexOf(query);
      if (idx === -1) return text;

      return (
        <>
          {text.slice(0, idx)}
          <mark className="bg-yellow-400/20 rounded-sm px-0.5">
            {text.slice(idx, idx + searchQuery.length)}
          </mark>
          {text.slice(idx + searchQuery.length)}
        </>
      );
    },
    [searchQuery],
  );

  if (segments.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Transcript
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          No transcript available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Transcript
        </h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filteredSegments.length} segment{filteredSegments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-2.5 top-2.5 text-[var(--muted-foreground)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search transcript..."
          className="focus-ring w-full rounded-lg bg-[var(--surface)] px-3 py-2 pl-8 text-sm text-[var(--foreground)] ring-1 ring-[var(--card-border)] placeholder:text-[var(--muted-foreground)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Segments */}
      <div className="fade-in max-h-96 space-y-0.5 overflow-y-auto">
        {filteredSegments.map((segment, idx) => {
          const isActive =
            !searchQuery.trim() &&
            segments.indexOf(segment) === activeSegmentIndex;

          return (
            <button
              key={idx}
              onClick={() => handleSegmentClick(segment.start)}
              className={`focus-ring flex w-full gap-3 px-2.5 py-2 text-left transition-colors duration-150 cursor-pointer ${
                isActive
                  ? "bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30 rounded-lg"
                  : "hover:bg-[var(--surface-hover)] rounded-lg"
              }`}
            >
              <span
                className="shrink-0 font-mono text-[var(--accent)] text-xs bg-[var(--accent-muted)] px-2 py-0.5 rounded"
              >
                {formatTimestamp(segment.start)}
              </span>
              <span
                className={`text-sm leading-relaxed ${
                  isActive
                    ? "font-medium text-[var(--foreground)]"
                    : "text-[var(--foreground)]/80"
                }`}
              >
                {highlightMatch(segment.text)}
              </span>
            </button>
          );
        })}

        {filteredSegments.length === 0 && searchQuery.trim() && (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            No segments matching &quot;{searchQuery}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
