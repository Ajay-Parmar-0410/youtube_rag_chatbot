export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp: number;
}

export interface ChatSession {
  readonly id: string;
  readonly videoId: string;
  readonly messages: readonly ChatMessage[];
  readonly createdAt: number;
}
