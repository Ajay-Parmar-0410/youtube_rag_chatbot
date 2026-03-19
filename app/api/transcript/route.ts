import { NextResponse } from "next/server";
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

    const ragServiceUrl = process.env.RAG_SERVICE_URL;
    if (!ragServiceUrl) {
      return NextResponse.json(
        { success: false, error: "RAG service is not configured." },
        { status: 503 },
      );
    }

    const response = await fetch(`${ragServiceUrl}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return NextResponse.json(
        {
          success: false,
          error: errorData?.error ?? "Failed to fetch transcript.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as { success?: boolean; data?: Record<string, unknown>; error?: string } & Record<string, unknown>;
    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to fetch transcript." },
        { status: 500 },
      );
    }
    const inner = (raw.data ?? raw) as Record<string, unknown>;
    const data: TranscriptResponseData = {
      segments: inner.segments as TranscriptSegment[],
      fullText: (inner.full_text ?? inner.fullText) as string,
    };
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const isConnectionError =
      error instanceof TypeError &&
      (error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED"));
    return NextResponse.json(
      {
        success: false,
        error: isConnectionError
          ? "RAG service is not running. Start the Python backend first."
          : "Internal server error.",
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
