"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import {
  VideoPlayerContext,
  type VideoPlayerAPI,
} from "@/lib/youtube-player";

/* ------------------------------------------------------------------ */
/* YouTube IFrame API global types                                     */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: YTPlayerOptions,
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number }) => void;
  };
}

interface YTPlayer {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getPlayerState: () => number;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

/* ------------------------------------------------------------------ */
/* Script loader (singleton)                                           */
/* ------------------------------------------------------------------ */

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

/* ------------------------------------------------------------------ */
/* Shared player state — lives outside components so Provider +        */
/* VideoPlayer can coordinate on the same YT.Player instance           */
/* ------------------------------------------------------------------ */

const PLAYER_CONTAINER_ID = "yt-player-container";

/* ------------------------------------------------------------------ */
/* VideoPlayerProvider — context only, no visual output                 */
/* ------------------------------------------------------------------ */

interface VideoPlayerProviderProps {
  readonly videoId: string;
  readonly children: ReactNode;
}

export function VideoPlayerProvider({ videoId, children }: VideoPlayerProviderProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);

  const apiRef = useRef<VideoPlayerAPI>({
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    seekTo: (seconds: number) =>
      playerRef.current?.seekTo(seconds, true),
    getPlayerState: () => playerRef.current?.getPlayerState() ?? -1,
  });

  useEffect(() => {
    if (!videoId) {
      setIsReady(false);
      return;
    }

    let destroyed = false;

    async function init() {
      await loadYouTubeAPI();
      if (destroyed) return;

      /* Wait for the container div to be in the DOM */
      const container = document.getElementById(PLAYER_CONTAINER_ID);
      if (!container) return;

      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
        return;
      }

      playerRef.current = new window.YT.Player(PLAYER_CONTAINER_ID, {
        videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (!destroyed) setIsReady(true);
          },
        },
      });
    }

    init();

    return () => {
      destroyed = true;
    };
  }, [videoId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const ctxValue = { player: isReady ? apiRef.current : null, isReady };

  return (
    <VideoPlayerContext.Provider value={ctxValue}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* VideoPlayer — renders the video container div                       */
/* ------------------------------------------------------------------ */

interface VideoPlayerProps {
  readonly videoId: string;
}

export default function VideoPlayer({ videoId }: VideoPlayerProps) {
  if (!videoId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--card-border)]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          <Play size={48} className="text-[var(--muted-foreground)]" />
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your video will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl">
      <div id={PLAYER_CONTAINER_ID} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
