"use client";

import { createContext, useContext } from "react";

export interface VideoPlayerAPI {
  readonly getCurrentTime: () => number;
  readonly seekTo: (seconds: number) => void;
  readonly getPlayerState: () => number;
}

export interface VideoPlayerContextValue {
  readonly player: VideoPlayerAPI | null;
  readonly isReady: boolean;
}

export const VideoPlayerContext = createContext<VideoPlayerContextValue>({
  player: null,
  isReady: false,
});

export function useVideoPlayer(): VideoPlayerContextValue {
  return useContext(VideoPlayerContext);
}

export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimestamp(display: string): number {
  const parts = display.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}
