import { NextResponse } from "next/server";

interface TestResult {
  readonly test: string;
  readonly status: number;
  readonly blocked: boolean;
  readonly time_ms: number;
  readonly headers?: Record<string, string>;
  readonly dataReceived?: boolean;
  readonly sampleData?: string;
  readonly error?: string;
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function testUrl(
  testName: string,
  url: string,
  headers?: Record<string, string>,
  includeBody?: boolean,
): Promise<NextResponse> {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      headers: headers ?? {},
      signal: AbortSignal.timeout(10_000),
    });

    const elapsedMs = Math.round(performance.now() - start);
    const blocked = response.status >= 400;

    const result: TestResult = {
      test: testName,
      status: response.status,
      blocked,
      time_ms: elapsedMs,
      headers: Object.fromEntries(response.headers.entries()),
    };

    if (includeBody) {
      const text = await response.text();
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          dataReceived: text.length > 0,
          sampleData: text.slice(0, 500),
        },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - start);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    return NextResponse.json({
      success: true,
      data: {
        test: testName,
        status: 0,
        blocked: true,
        time_ms: elapsedMs,
        error: errorMessage,
      },
    });
  }
}
