export const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([\w-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([\w-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]{11})/,
] as const;

export const API_ENDPOINTS = {
  transcript: "/api/transcript",
  qa: "/api/qa",
  summary: "/api/summary",
  notes: "/api/notes",
  chatSessions: "/api/chat/sessions",
  flashcards: "/api/flashcards",
  topics: "/api/topics",
  prefetch: "/api/prefetch",
} as const;

export const RAG_CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
  retrievalK: 4,
  maxQuestionLength: 1000,
  minQuestionLength: 1,
} as const;

export const MODEL_NAMES = {
  primary: "llama-3.3-70b-versatile",
  lightweight: "llama-3.1-8b-instant",
  embedding: "BAAI/bge-small-en-v1.5",
} as const;

export const TIMEOUTS = {
  qa: 30_000,
  summary: 60_000,
  transcript: 15_000,
  flashcards: 45_000,
  topics: 30_000,
  prefetch: 120_000,
} as const;
