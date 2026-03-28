import { NextResponse } from "next/server";

const VALID_TESTS = [
  "swiggy-basic",
  "swiggy-api",
  "swiggy-search",
  "zomato-basic",
  "zomato-api",
] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testName = searchParams.get("test");

  if (!testName || !VALID_TESTS.includes(testName as (typeof VALID_TESTS)[number])) {
    return NextResponse.json(
      { success: false, error: "Invalid test name" },
      { status: 400 },
    );
  }

  const ragServiceUrl = process.env.RAG_SERVICE_URL;
  if (!ragServiceUrl) {
    return NextResponse.json(
      { success: false, error: "RAG_SERVICE_URL not configured" },
      { status: 503 },
    );
  }

  try {
    const url = `${ragServiceUrl.replace(/\/$/, "")}/test-apis/${testName}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    const json = await response.json();
    return NextResponse.json(json);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      success: true,
      data: {
        test: testName,
        status: 0,
        blocked: true,
        time_ms: 0,
        error: `Railway request failed: ${errorMessage}`,
      },
    });
  }
}
