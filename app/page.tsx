"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, FileText, PenLine, Layers } from "lucide-react";
import UrlInput from "@/components/UrlInput";
import VideoPlayer, { VideoPlayerProvider } from "@/components/VideoPlayer";
import ContentPanel from "@/components/ContentPanel";
import NotesEditor from "@/components/NotesEditor";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Smart Q&A",
    description: "Ask anything about the video",
  },
  {
    icon: FileText,
    title: "AI Summaries",
    description: "Brief and detailed breakdowns",
  },
  {
    icon: PenLine,
    title: "Smart Notes",
    description: "Auto-timestamps as you type",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description: "Study with generated cards",
  },
] as const;

export default function Home() {
  const searchParams = useSearchParams();
  const [videoId, setVideoId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /* Read ?v= query param on mount (e.g. from dashboard note click) */
  useEffect(() => {
    const v = searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) {
      setVideoId(v);
    }
  }, [searchParams]);

  const handleSubmit = useCallback((id: string) => {
    setIsLoading(true);
    setVideoId(id);
    setIsLoading(false);
  }, []);

  return (
    <VideoPlayerProvider videoId={videoId}>
      <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-4 sm:py-4 lg:px-8">
        {!videoId ? (
          /* ---- Landing Hero ---- */
          <div className="mx-auto max-w-3xl py-12 text-center sm:py-20">
            {/* Hero heading */}
            <div className="mb-8 flex flex-col items-center gap-3">
              <svg
                className="h-10 w-10 text-[var(--accent)]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M23.498 6.186a2.994 2.994 0 0 0-2.112-2.12C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.386.52A2.994 2.994 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.994 2.994 0 0 0 2.112 2.12c1.881.52 9.386.52 9.386.52s7.505 0 9.386-.52a2.994 2.994 0 0 0 2.112-2.12C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
              </svg>
              <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                YouTube RAG
              </h1>
              <p className="text-xl text-[var(--muted-foreground)]">
                Watch. Ask. Learn.
              </p>
            </div>

            {/* URL Input */}
            <div className="mb-12">
              <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />
            </div>

            {/* Feature grid */}
            <div className="stagger-in grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="fade-in card-hover rounded-xl bg-[var(--card)] p-6 ring-1 ring-[var(--card-border)]"
                >
                  <div className="mb-3 flex justify-center">
                    <feature.icon
                      size={28}
                      className="text-[var(--accent)]"
                    />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ---- Video-loaded layout (unchanged) ---- */
          <>
            <div className="mb-3 sm:mb-4">
              <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />
            </div>

            {/* Layout: single column mobile, two columns desktop */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_380px]">
              {/* Left column: Video on top, Content panel below */}
              <div className="flex flex-col gap-3 sm:gap-4">
                <VideoPlayer videoId={videoId} />
                <div className="min-h-[300px] sm:min-h-[400px]">
                  <ContentPanel videoId={videoId} />
                </div>
              </div>

              {/* Right column: Notes — sticky on desktop, normal flow on mobile */}
              <div className="lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto scrollbar-none">
                <NotesEditor videoId={videoId} />
              </div>
            </div>
          </>
        )}
      </div>
    </VideoPlayerProvider>
  );
}
