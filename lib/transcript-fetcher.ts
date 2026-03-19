import { Innertube } from "youtubei.js";

interface TranscriptSegment {
  readonly text: string;
  readonly start: number;
  readonly duration: number;
}

interface TranscriptResult {
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

/**
 * Fetch transcript using YouTube's Innertube API.
 * This works better from cloud IPs than scraping approaches
 * because it authenticates as a proper YouTube client.
 */
async function fetchViaInnertube(videoId: string): Promise<TranscriptResult> {
  const yt = await Innertube.create();
  const info = await yt.getInfo(videoId);
  const transcriptData = await info.getTranscript();

  const body = transcriptData?.transcript?.content?.body;
  if (!body || !("initial_segments" in body) || !body.initial_segments?.length) {
    throw new Error("No transcript available for this video.");
  }

  const segments: TranscriptSegment[] = (body.initial_segments as unknown[])
    .filter((seg) => {
      const s = seg as Record<string, unknown>;
      return "snippet" in s && "start_ms" in s;
    })
    .map((seg) => {
      const s = seg as Record<string, unknown>;
      const snippet = s.snippet as { text?: string } | undefined;
      const startMs = Number(s.start_ms ?? 0);
      const endMs = Number(s.end_ms ?? startMs);
      return {
        text: snippet?.text ?? "",
        start: startMs / 1000,
        duration: (endMs - startMs) / 1000,
      };
    })
    .filter((s) => s.text.length > 0);

  if (segments.length === 0) {
    throw new Error("Transcript has no text content.");
  }

  const fullText = segments.map((s) => s.text).join(" ");
  return { segments, fullText };
}

/**
 * Fetch transcript using the youtube-transcript npm package as fallback.
 */
async function fetchViaYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
  const { YoutubeTranscript } = await import("youtube-transcript");
  const items = await YoutubeTranscript.fetchTranscript(videoId);

  const segments: TranscriptSegment[] = items.map((item) => ({
    text: item.text,
    start: item.offset / 1000,
    duration: item.duration / 1000,
  }));

  const fullText = segments.map((s) => s.text).join(" ");
  return { segments, fullText };
}

/**
 * Fetch transcript with fallback chain:
 * 1. Innertube API (works better from cloud IPs)
 * 2. youtube-transcript package (scraping fallback)
 */
export async function fetchTranscriptFromVercel(
  videoId: string,
): Promise<TranscriptResult> {
  // Try Innertube first (better cloud IP compatibility)
  try {
    return await fetchViaInnertube(videoId);
  } catch (innertubeError) {
    console.warn("Innertube transcript failed, trying fallback:", innertubeError);
  }

  // Fallback to youtube-transcript package
  try {
    return await fetchViaYoutubeTranscript(videoId);
  } catch (fallbackError) {
    console.error("All transcript methods failed:", fallbackError);
    throw new Error(
      `Could not fetch transcript for video ${videoId}. The video may not have captions available.`,
    );
  }
}
