import { NextResponse } from "next/server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { fetchTranscriptFromVercel } from "@/lib/transcript-fetcher";
import type { ApiResponse, SummaryResponse } from "@/types/api";

const VALID_MODES = ["brief", "detailed"] as const;

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

function isValidMode(mode: unknown): mode is "brief" | "detailed" {
  return typeof mode === "string" && VALID_MODES.includes(mode as "brief" | "detailed");
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<SummaryResponse>>> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResult = checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, mode, language } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    if (!isValidMode(mode)) {
      return NextResponse.json(
        { success: false, error: "Mode must be 'brief' or 'detailed'." },
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

    const response = await fetch(`${ragServiceUrl}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        mode,
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
          error: errorData?.error ?? "Failed to generate summary.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as { success?: boolean; data?: SummaryResponse; error?: string };
    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to generate summary." },
        { status: 500 },
      );
    }
    const data = raw.data ?? (raw as unknown as SummaryResponse);
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
          : `Internal server error: ${error instanceof Error ? error.message : "unknown"}`,
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
