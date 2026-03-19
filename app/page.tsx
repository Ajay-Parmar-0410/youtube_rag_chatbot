"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import UrlInput from "@/components/UrlInput";
import VideoPlayer, { VideoPlayerProvider } from "@/components/VideoPlayer";
import ContentPanel from "@/components/ContentPanel";
import NotesEditor from "@/components/NotesEditor";

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
          <div className="lg:sticky lg:top-4 lg:self-start">
            <NotesEditor videoId={videoId} />
          </div>
        </div>
      </div>
    </VideoPlayerProvider>
  );
}
