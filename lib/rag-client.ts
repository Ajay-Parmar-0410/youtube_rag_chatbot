import { API_ENDPOINTS, TIMEOUTS } from "@/lib/constants";
import type {
  ApiResponse,
  ChatHistoryEntry,
  FlashcardResponse,
  QAResponse,
  SummaryResponse,
  TopicsResponse,
  TranscriptSegment,
} from "@/types/api";

interface TranscriptResponse {
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return {
        success: false,
        error: `Service unavailable (status ${response.status}). Please try again later.`,
      };
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      return {
        success: false,
        error: json.error ?? `Request failed with status ${response.status}`,
      };
    }

    return json;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, error: "Request timed out. Please try again." };
    }

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchTranscript(
  videoId: string,
): Promise<ApiResponse<TranscriptResponse>> {
  return fetchWithTimeout<TranscriptResponse>(
    API_ENDPOINTS.transcript,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    },
    TIMEOUTS.transcript,
  );
}

export async function fetchSummary(
  videoId: string,
  mode: "brief" | "detailed",
  language?: string,
): Promise<ApiResponse<SummaryResponse>> {
  return fetchWithTimeout<SummaryResponse>(
    API_ENDPOINTS.summary,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, mode, ...(language ? { language } : {}) }),
    },
    TIMEOUTS.summary,
  );
}

export async function askQuestion(
  videoId: string,
  question: string,
  chatHistory: readonly ChatHistoryEntry[],
  language?: string,
): Promise<ApiResponse<QAResponse>> {
  return fetchWithTimeout<QAResponse>(
    API_ENDPOINTS.qa,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, question, chatHistory, ...(language ? { language } : {}) }),
    },
    TIMEOUTS.qa,
  );
}

export async function fetchFlashcards(
  videoId: string,
  count: number = 10,
  language?: string,
): Promise<ApiResponse<FlashcardResponse>> {
  return fetchWithTimeout<FlashcardResponse>(
    API_ENDPOINTS.flashcards,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, count, ...(language ? { language } : {}) }),
    },
    TIMEOUTS.flashcards,
  );
}

export async function fetchTopics(
  videoId: string,
  language?: string,
): Promise<ApiResponse<TopicsResponse>> {
  return fetchWithTimeout<TopicsResponse>(
    API_ENDPOINTS.topics,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, ...(language ? { language } : {}) }),
    },
    TIMEOUTS.topics,
  );
}
