import { NextResponse } from "next/server";
import { fetchTranscriptFromVercel } from "@/lib/transcript-fetcher";
import type { ApiResponse, FlashcardResponse } from "@/types/api";

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

function isValidCount(count: unknown): count is number {
  return typeof count === "number" && count >= 1 && count <= 30;
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<FlashcardResponse>>> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, count = 10, language } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    if (!isValidCount(count)) {
      return NextResponse.json(
        { success: false, error: "Count must be between 1 and 30." },
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

    // Fetch transcript on Vercel (bypasses YouTube cloud IP blocks)
    const transcript = await fetchTranscriptFromVercel(videoId);

    const response = await fetch(`${ragServiceUrl}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        count,
        transcript_text: transcript.fullText,
        ...(typeof language === "string" && language !== "English" ? { language } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return NextResponse.json(
        {
          success: false,
          error: errorData?.error ?? "Failed to generate flashcards.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as {
      success?: boolean;
      data?: FlashcardResponse;
      error?: string;
    };
    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to generate flashcards." },
        { status: 500 },
      );
    }
    const data = raw.data ?? (raw as unknown as FlashcardResponse);
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
