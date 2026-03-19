interface TranscriptSegment {
  readonly text: string;
  readonly start: number;
  readonly duration: number;
}

interface TranscriptResult {
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

interface SupadataSegment {
  readonly text: string;
  readonly offset: number;
  readonly duration: number;
  readonly lang: string;
}

interface SupadataResponse {
  readonly lang: string;
  readonly content: readonly SupadataSegment[];
}

/**
 * Fetch transcript via Supadata's free transcript API.
 * Works reliably from cloud IPs (Vercel, Railway, AWS, etc.)
 * because it doesn't scrape YouTube directly.
 */
async function fetchViaSupadata(videoId: string): Promise<TranscriptResult> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    throw new Error("SUPADATA_API_KEY is not configured.");
  }

  const url = `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`;
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Supadata API returned ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as SupadataResponse;

  if (!data.content || data.content.length === 0) {
    throw new Error("Supadata returned empty transcript.");
  }

  const segments: TranscriptSegment[] = data.content
    .filter((seg) => seg.text.trim().length > 0)
    .map((seg) => ({
      text: seg.text.trim(),
      start: seg.offset / 1000,
      duration: seg.duration / 1000,
    }));

  if (segments.length === 0) {
    throw new Error("Transcript has no text content.");
  }

  const fullText = segments.map((s) => s.text).join(" ");
  return { segments, fullText };
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

/**
 * Fetch transcript using YouTube's Innertube Player API.
 * Works for some popular videos from cloud IPs.
 */
async function fetchViaInnertube(videoId: string): Promise<TranscriptResult> {
  const playerResponse = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": "2.20241126.01.00",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20241126.01.00",
            hl: "en",
            gl: "US",
          },
        },
      }),
    },
  );

  if (!playerResponse.ok) {
    throw new Error(`Innertube player API returned ${playerResponse.status}`);
  }

  const playerData = await playerResponse.json();
  const captionTracks: CaptionTrack[] =
    playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  if (captionTracks.length === 0) {
    throw new Error("No captions available for this video.");
  }

  const englishTrack =
    captionTracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    captionTracks.find((t) => t.languageCode === "en") ??
    captionTracks.find((t) => t.kind !== "asr") ??
    captionTracks[0];

  const captionUrl = new URL(englishTrack.baseUrl);
  captionUrl.searchParams.set("fmt", "json3");

  const captionResponse = await fetch(captionUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!captionResponse.ok) {
    throw new Error(`Caption fetch returned ${captionResponse.status}`);
  }

  const captionData = await captionResponse.json();
  const events = captionData?.events ?? [];

  const segments: TranscriptSegment[] = events
    .filter((e: Record<string, unknown>) => e.segs && typeof e.tStartMs === "number")
    .map((e: Record<string, unknown>) => {
      const segs = e.segs as Array<{ utf8?: string }>;
      const text = segs
        .map((s) => s.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      const startMs = e.tStartMs as number;
      const durationMs = (e.dDurationMs as number) ?? 0;
      return {
        text,
        start: startMs / 1000,
        duration: durationMs / 1000,
      };
    })
    .filter((s: TranscriptSegment) => s.text.length > 0);

  if (segments.length === 0) {
    throw new Error("Transcript has no text content.");
  }

  const fullText = segments.map((s) => s.text).join(" ");
  return { segments, fullText };
}

/**
 * Fetch transcript using the youtube-transcript npm package as fallback.
 */
async function fetchViaYoutubeTranscript(
  videoId: string,
): Promise<TranscriptResult> {
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
 * 1. Supadata API (works from cloud IPs, free tier)
 * 2. Direct Innertube Player API (works for some popular videos)
 * 3. youtube-transcript package (scraping fallback)
 */
export async function fetchTranscriptFromVercel(
  videoId: string,
): Promise<TranscriptResult> {
  // Try Supadata API first (most reliable from cloud)
  try {
    return await fetchViaSupadata(videoId);
  } catch (supadataError) {
    console.warn("Supadata transcript failed, trying Innertube:", supadataError);
  }

  // Try Innertube Player API
  try {
    return await fetchViaInnertube(videoId);
  } catch (innertubeError) {
    console.warn(
      "Innertube transcript failed, trying youtube-transcript:",
      innertubeError,
    );
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
