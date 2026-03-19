import { NextResponse } from "next/server";
import { RAG_CONFIG } from "@/lib/constants";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import type { ApiResponse, QAResponse } from "@/types/api";

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

function isValidQuestion(q: unknown): q is string {
  return (
    typeof q === "string" &&
    q.trim().length >= RAG_CONFIG.minQuestionLength &&
    q.trim().length <= RAG_CONFIG.maxQuestionLength
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<QAResponse>>> {
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
    const { videoId, question, chatHistory, language } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    if (!isValidQuestion(question)) {
      return NextResponse.json(
        {
          success: false,
          error: `Question must be between ${RAG_CONFIG.minQuestionLength} and ${RAG_CONFIG.maxQuestionLength} characters.`,
        },
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

    const response = await fetch(`${ragServiceUrl}/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        question: (question as string).trim(),
        chat_history: (chatHistory as Array<{role: string; content: string}>) ?? [],
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
          error: errorData?.error ?? "Failed to get an answer.",
        },
        { status: response.status },
      );
    }

    const raw = (await response.json()) as { success?: boolean; data?: QAResponse; error?: string };
    if (raw.success === false) {
      return NextResponse.json(
        { success: false, error: raw.error ?? "Failed to get an answer." },
        { status: 500 },
      );
    }
    const data = raw.data ?? (raw as unknown as QAResponse);
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
