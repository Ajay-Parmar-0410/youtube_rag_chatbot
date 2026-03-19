import { NextResponse } from "next/server";
import type { ApiResponse, TopicsResponse } from "@/types/api";

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<TopicsResponse>>> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, language } = body;

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

    const response = await fetch(`${ragServiceUrl}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
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
          error: errorData?.error ?? "Failed to extract topics.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as {
      success?: boolean;
      data?: TopicsResponse;
      error?: string;
    };
    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to extract topics." },
        { status: 500 },
      );
    }
    const data = raw.data ?? (raw as unknown as TopicsResponse);
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
