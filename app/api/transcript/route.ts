import { NextResponse } from "next/server";
import { fetchTranscriptFromVercel } from "@/lib/transcript-fetcher";
import type { ApiResponse, TranscriptSegment } from "@/types/api";

interface TranscriptResponseData {
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<TranscriptResponseData>>> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    const result = await fetchTranscriptFromVercel(videoId);
    const data: TranscriptResponseData = {
      segments: result.segments as TranscriptSegment[],
      fullText: result.fullText,
    };
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch transcript.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
