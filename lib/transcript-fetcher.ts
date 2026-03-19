import { YoutubeTranscript } from "youtube-transcript";

interface TranscriptSegment {
  readonly text: string;
  readonly start: number;
  readonly duration: number;
}

interface TranscriptResult {
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

export async function fetchTranscriptFromVercel(
  videoId: string,
): Promise<TranscriptResult> {
  const items = await YoutubeTranscript.fetchTranscript(videoId);

  const segments: TranscriptSegment[] = items.map((item) => ({
    text: item.text,
    start: item.offset / 1000,
    duration: item.duration / 1000,
  }));

  const fullText = segments.map((s) => s.text).join(" ");

  return { segments, fullText };
}
