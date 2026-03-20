"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
} from "react";
import { askQuestion } from "@/lib/rag-client";
import { RAG_CONFIG } from "@/lib/constants";
import { useAuth } from "@/components/AuthProvider";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import type { ChatHistoryEntry } from "@/types/api";
import ChatMessage from "@/components/ChatMessage";

interface ChatPanelProps {
  readonly videoId: string;
}

export default function ChatPanel({ videoId }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<readonly ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setSessionId(null);

    if (!videoId || !user) return;

    let cancelled = false;

    async function loadSession() {
      try {
        const sessionsRes = await fetch("/api/chat/sessions");
        if (!sessionsRes.ok) return;
        const sessionsBody = await sessionsRes.json();
        if (cancelled || !sessionsBody.success) return;

        const existing = sessionsBody.data?.find(
          (s: { video_id: string }) => s.video_id === videoId,
        );
        if (!existing) return;

        setSessionId(existing.id);

        const msgsRes = await fetch(
          `/api/chat/sessions/${existing.id}/messages`,
        );
        if (!msgsRes.ok) return;
        const msgsBody = await msgsRes.json();
        if (cancelled || !msgsBody.success) return;

        const loaded: ChatMessageType[] = msgsBody.data.map(
          (m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            created_at: string;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
          }),
        );
        setMessages(loaded);
      } catch {
        // Silently fail
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [videoId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildChatHistory = useCallback(
    (msgs: readonly ChatMessageType[]): readonly ChatHistoryEntry[] =>
      msgs.map((m) => ({ role: m.role, content: m.content })),
    [],
  );

  const persistMessage = useCallback(
    async (
      currentSessionId: string,
      role: "user" | "assistant",
      content: string,
    ) => {
      try {
        await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content }),
        });
      } catch {
        // Fire and forget
      }
    },
    [],
  );

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!user) return null;

    try {
      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!response.ok) return null;
      const body = await response.json();
      if (!body.success) return null;
      const newId = body.data.id as string;
      setSessionId(newId);
      return newId;
    } catch {
      return null;
    }
  }, [sessionId, user, videoId]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || !videoId || isLoading) return;

      const userMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      if (user) {
        const sid = await ensureSession();
        if (sid) {
          persistMessage(sid, "user", trimmed);
        }
      }

      const result = await askQuestion(
        videoId,
        trimmed,
        buildChatHistory(updatedMessages),
      );

      const assistantContent =
        result.success && result.data
          ? result.data.answer
          : result.error ?? "Sorry, something went wrong. Please try again.";

      const assistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);

      if (user && sessionId) {
        persistMessage(sessionId, "assistant", assistantContent);
      }
    },
    [
      input,
      videoId,
      isLoading,
      messages,
      user,
      sessionId,
      buildChatHistory,
      ensureSession,
      persistMessage,
    ],
  );

  if (!videoId) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Q&A
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to ask questions about it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-[var(--card)] shadow-sm ring-1 ring-[var(--card-border)]">
      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Q&A
        </h2>
        {!user && (
          <span className="text-xs text-[var(--muted-foreground)]">
            Sign in to save chat history
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            Ask a question about the video...
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--muted)] px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)] [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)] [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)] [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--card-border)] p-3"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            maxLength={RAG_CONFIG.maxQuestionLength}
            className="focus-ring flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-all duration-150 focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-press focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
