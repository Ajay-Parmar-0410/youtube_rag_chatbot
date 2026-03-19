import { extractVideoId } from "./youtube";
import { RAG_CONFIG } from "./constants";

interface ValidationResult {
  readonly valid: boolean;
  readonly videoId?: string;
  readonly error?: string;
}

interface QueryValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

export function validateYouTubeUrl(url: string): ValidationResult {
  if (!url || !url.trim()) {
    return { valid: false, error: "URL is required" };
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return { valid: false, error: "Invalid YouTube URL" };
  }

  return { valid: true, videoId };
}

export function validateQuery(query: string): QueryValidationResult {
  if (!query || !query.trim()) {
    return { valid: false, error: "Question is required" };
  }

  const trimmed = query.trim();
  if (trimmed.length < RAG_CONFIG.minQuestionLength) {
    return { valid: false, error: "Question is too short" };
  }

  if (trimmed.length > RAG_CONFIG.maxQuestionLength) {
    return {
      valid: false,
      error: `Question must be under ${RAG_CONFIG.maxQuestionLength} characters`,
    };
  }

  return { valid: true };
}
