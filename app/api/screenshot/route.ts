import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";

interface ScreenshotResponseData {
  readonly image: string;
  readonly timestamp: number;
}

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<ScreenshotResponseData>>> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, timestamp } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    if (typeof timestamp !== "number" || timestamp < 0) {
      return NextResponse.json(
        { success: false, error: "A valid timestamp is required." },
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

    const response = await fetch(`${ragServiceUrl}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, timestamp }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return NextResponse.json(
        {
          success: false,
          error: errorData?.error ?? "Failed to capture screenshot.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as {
      success?: boolean;
      data?: ScreenshotResponseData;
      error?: string;
    };

    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to capture screenshot." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: raw.data });
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
