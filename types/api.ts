export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface TranscriptSegment {
  readonly text: string;
  readonly start: number;
  readonly duration: number;
}

export interface VideoMetadata {
  readonly videoId: string;
  readonly title?: string;
  readonly thumbnailUrl?: string;
}

export interface QARequest {
  readonly videoId: string;
  readonly question: string;
  readonly chatHistory?: readonly ChatHistoryEntry[];
}

export interface ChatHistoryEntry {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface QAResponse {
  readonly answer: string;
  readonly sources?: readonly string[];
}

export interface SummaryRequest {
  readonly videoId: string;
  readonly mode: "brief" | "detailed";
}

export interface SummaryResponse {
  readonly summary: string;
  readonly mode: "brief" | "detailed";
}

export interface Flashcard {
  readonly question: string;
  readonly answer: string;
  readonly difficulty: "easy" | "medium" | "hard";
}

export interface FlashcardResponse {
  readonly flashcards: readonly Flashcard[];
  readonly video_id: string;
}

export interface Topic {
  readonly topic: string;
  readonly description: string;
  readonly timestamp_start: number;
}

export interface TopicsResponse {
  readonly topics: readonly Topic[];
  readonly video_id: string;
}
