import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResult = checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many requests. Please try again later.",
      }),
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, language } = body;

    if (!isValidVideoId(videoId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "A valid YouTube video ID is required.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const ragServiceUrl = process.env.RAG_SERVICE_URL;
    if (!ragServiceUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RAG service is not configured.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const upstream = await fetch(`${ragServiceUrl}/prefetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        ...(typeof language === "string" && language !== "English"
          ? { language }
          : {}),
      }),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Prefetch service unavailable.",
        }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } },
      );
    }

    // Pipe the SSE stream through to the client
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const isConnectionError =
      error instanceof TypeError &&
      (error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED"));
    return new Response(
      JSON.stringify({
        success: false,
        error: isConnectionError
          ? "RAG service is not running. Start the Python backend first."
          : "Internal server error.",
      }),
      {
        status: isConnectionError ? 503 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
