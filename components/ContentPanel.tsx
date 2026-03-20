"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import { askQuestion, fetchSummary, fetchTranscript } from "@/lib/rag-client";
import { RAG_CONFIG } from "@/lib/constants";
import { useAuth } from "@/components/AuthProvider";
import { useVideoPlayer } from "@/lib/youtube-player";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import type { ChatHistoryEntry, TranscriptSegment } from "@/types/api";
import dynamic from "next/dynamic";
import ChatMessage from "@/components/ChatMessage";
import LanguageSelector, { useLanguagePreference } from "@/components/LanguageSelector";
import { usePrefetch, type PrefetchStatus } from "@/lib/prefetch";
import { MessageCircle, FileText, BookOpen, Captions, Layers, Lightbulb, Send } from "lucide-react";

const FlashcardViewer = dynamic(() => import("@/components/FlashcardViewer"), {
  loading: () => (
    <div className="flex h-56 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
    </div>
  ),
});

const TopicsList = dynamic(() => import("@/components/TopicsList"), {
  loading: () => (
    <div className="flex h-40 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
    </div>
  ),
});

const TranscriptViewer = dynamic(() => import("@/components/TranscriptViewer"), {
  loading: () => (
    <div className="flex h-40 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
    </div>
  ),
});

interface ContentPanelProps {
  readonly videoId: string;
}

type TabMode = "qa" | "brief" | "detailed" | "transcript" | "flashcards" | "topics";

interface SummaryCache {
  readonly brief: string | null;
  readonly detailed: string | null;
  readonly transcript: string | null;
}

const EMPTY_CACHE: SummaryCache = {
  brief: null,
  detailed: null,
  transcript: null,
};

const TAB_ICONS: Record<TabMode, React.ReactNode> = {
  qa: <MessageCircle size={14} />,
  brief: <FileText size={14} />,
  detailed: <BookOpen size={14} />,
  transcript: <Captions size={14} />,
  flashcards: <Layers size={14} />,
  topics: <Lightbulb size={14} />,
};

const TABS: { label: string; value: TabMode }[] = [
  { label: "Q&A", value: "qa" },
  { label: "Brief", value: "brief" },
  { label: "Detailed", value: "detailed" },
  { label: "Transcript", value: "transcript" },
  { label: "Flashcards", value: "flashcards" },
  { label: "Topics", value: "topics" },
];

const SUGGESTED_QUESTIONS = [
  "What is this video about?",
  "Summarize the key points",
  "What are the main takeaways?",
];

export default function ContentPanel({ videoId }: ContentPanelProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("qa");
  const { player } = useVideoPlayer();
  const [language, setLanguage] = useLanguagePreference();

  // --- Prefetch ---
  const { status: prefetchStatus, data: prefetchData, fetchedLanguage } = usePrefetch(videoId, language);

  // --- Summary/Transcript state ---
  const [summaryCache, setSummaryCache] = useState<SummaryCache>(EMPTY_CACHE);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<readonly TranscriptSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const cachedVideoId = useRef<string>("");

  // --- Q&A state ---
  const { user } = useAuth();
  const [messages, setMessages] = useState<readonly ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSeek = useCallback(
    (seconds: number) => {
      player?.seekTo(seconds);
    },
    [player],
  );

  // Poll current time for transcript highlighting
  useEffect(() => {
    if (activeTab !== "transcript" || !player) return;
    const interval = setInterval(() => {
      setCurrentTime(player.getCurrentTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, player]);

  // Reset everything when video changes
  useEffect(() => {
    if (videoId && videoId !== cachedVideoId.current) {
      cachedVideoId.current = videoId;
      setSummaryCache(EMPTY_CACHE);
      setSummaryLoading(false);
      setSummaryError(null);
      setTranscriptSegments([]);
      setMessages([]);
      setInput("");
      setSessionId(null);
      setActiveTab("qa");
    } else if (!videoId) {
      cachedVideoId.current = "";
      setSummaryCache(EMPTY_CACHE);
      setTranscriptSegments([]);
      setMessages([]);
      setActiveTab("qa");
    }
  }, [videoId]);

  // Load chat session when video/user changes
  useEffect(() => {
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

  // Clear summary cache when language changes — prefetch will re-run automatically
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      setSummaryCache((prev) => ({ ...prev, brief: null, detailed: null }));
      setSummaryError(null);
    }
  }, [language]);

  // Feed prefetch data into summary cache as it arrives
  // Guard: only feed data when the prefetched language matches the current language
  useEffect(() => {
    if (fetchedLanguage !== language) return;
    if (prefetchData.brief && summaryCache.brief === null) {
      setSummaryCache((prev) => ({ ...prev, brief: prefetchData.brief! }));
    }
    if (prefetchData.detailed && summaryCache.detailed === null) {
      setSummaryCache((prev) => ({ ...prev, detailed: prefetchData.detailed! }));
    }
  }, [prefetchData.brief, prefetchData.detailed, summaryCache.brief, summaryCache.detailed, language, fetchedLanguage]);

  // --- Summary/Transcript loading ---
  const loadSummaryContent = useCallback(
    async (mode: "brief" | "detailed" | "transcript") => {
      if (!videoId) return;

      if (
        summaryCache[mode] !== null &&
        cachedVideoId.current === videoId
      ) {
        return;
      }

      // Don't fire a duplicate request if prefetch is already loading this task
      if (mode !== "transcript") {
        const prefetchState = prefetchStatus[mode];
        if (prefetchState === "loading" || prefetchState === "complete") {
          return;
        }
      }

      setSummaryLoading(true);
      setSummaryError(null);

      if (mode === "transcript") {
        const result = await fetchTranscript(videoId);
        if (result.success && result.data) {
          setTranscriptSegments(result.data.segments);
          const formatted = result.data.segments
            .map((seg) => {
              const mins = Math.floor(seg.start / 60);
              const secs = Math.floor(seg.start % 60);
              const ts = `${mins}:${secs.toString().padStart(2, "0")}`;
              return `**[${ts}]** ${seg.text}`;
            })
            .join("\n\n");
          setSummaryCache((prev) => ({ ...prev, transcript: formatted }));
        } else {
          setSummaryError(result.error ?? "Failed to load transcript.");
        }
      } else {
        const langParam = language !== "English" ? language : undefined;
        const result = await fetchSummary(videoId, mode, langParam);
        if (result.success && result.data) {
          setSummaryCache((prev) => ({
            ...prev,
            [mode]: result.data!.summary,
          }));
        } else {
          setSummaryError(result.error ?? "Failed to load summary.");
        }
      }
      setSummaryLoading(false);
    },
    [videoId, summaryCache, language, prefetchStatus],
  );

  const handleTabSwitch = useCallback(
    (tab: TabMode) => {
      setActiveTab(tab);
      setSummaryError(null);
      if (tab === "brief" || tab === "detailed" || tab === "transcript") {
        loadSummaryContent(tab);
      }
    },
    [loadSummaryContent],
  );

  // --- Q&A handlers ---
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

  const handleQaSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || !videoId || qaLoading) return;

      const userMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setQaLoading(true);

      if (user) {
        const sid = await ensureSession();
        if (sid) {
          persistMessage(sid, "user", trimmed);
        }
      }

      const langParam = language !== "English" ? language : undefined;
      const result = await askQuestion(
        videoId,
        trimmed,
        buildChatHistory(updatedMessages),
        langParam,
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
      setQaLoading(false);

      if (user && sessionId) {
        persistMessage(sessionId, "assistant", assistantContent);
      }
    },
    [
      input,
      videoId,
      qaLoading,
      messages,
      user,
      sessionId,
      language,
      buildChatHistory,
      ensureSession,
      persistMessage,
    ],
  );

  // --- Prefetch status dot color ---
  const getStatusDot = (tab: TabMode): string | null => {
    const taskMap: Record<string, keyof PrefetchStatus> = {
      brief: "brief",
      detailed: "detailed",
      flashcards: "flashcards",
      topics: "topics",
    };
    const task = taskMap[tab];
    if (!task) return null;
    const s = prefetchStatus[task];
    if (s === "pending") return "bg-gray-400";
    if (s === "loading") return "bg-yellow-400 animate-pulse ring-2 ring-yellow-400/30";
    if (s === "complete") return "bg-green-400 ring-2 ring-green-400/20";
    if (s === "error") return "bg-red-400 ring-2 ring-red-400/20";
    return null;
  };

  // --- Empty state ---
  if (!videoId) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Q&A & Summary
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to ask questions and view summaries.
        </p>
      </div>
    );
  }

  // --- Current summary content ---
  const currentSummaryContent =
    activeTab === "brief" || activeTab === "detailed" || activeTab === "transcript"
      ? summaryCache[activeTab]
      : null;

  // Show loading skeleton when either direct fetch OR prefetch is in progress
  const isSummaryLoading =
    summaryLoading ||
    ((activeTab === "brief" || activeTab === "detailed") &&
      currentSummaryContent === null &&
      (prefetchStatus[activeTab] === "loading" || prefetchStatus[activeTab] === "pending"));

  return (
    <div className="flex h-full flex-col rounded-xl bg-[var(--card)] shadow-sm ring-1 ring-[var(--card-border)]">
      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="flex flex-col gap-2 border-b border-[var(--card-border)] px-3 py-2 sm:flex-row sm:items-center sm:px-4">
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-2 scrollbar-none sm:border-b-0 sm:pb-0">
          {TABS.map((tab) => {
            const dot = getStatusDot(tab.value);
            return (
              <button
                key={tab.value}
                onClick={() => handleTabSwitch(tab.value)}
                disabled={isSummaryLoading && tab.value !== "qa"}
                className={`focus-ring shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
                  activeTab === tab.value
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {TAB_ICONS[tab.value]}
                  {tab.label}
                  {dot && (
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <LanguageSelector value={language} onChange={setLanguage} />
          {activeTab === "qa" && !user && (
            <span className="text-xs text-[var(--muted-foreground)]">
              Sign in to save
            </span>
          )}
        </div>
      </div>

      {/* Q&A tab content */}
      {activeTab === "qa" && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-8">
                <MessageCircle size={32} className="text-[var(--muted-foreground)]" />
                <p className="text-base font-medium text-[var(--foreground)]">
                  Ask anything about this video
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInput(q)}
                      className="focus-ring rounded-full bg-[var(--card-elevated)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all duration-150 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {qaLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border-l-2 border-[var(--accent)] bg-[var(--muted)] px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleQaSubmit}
            className="border-t border-[var(--card-border)] p-3"
          >
            <div className="flex gap-2 shadow-sm rounded-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={qaLoading}
                maxLength={RAG_CONFIG.maxQuestionLength}
                className="focus-ring flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-all duration-150 focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={qaLoading || !input.trim()}
                className="btn-press focus-ring rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </>
      )}

      {/* Summary tab content (brief/detailed) */}
      {(activeTab === "brief" || activeTab === "detailed") && (
        <div className="flex-1 overflow-y-auto p-4">
          {isSummaryLoading && (
            <div className="space-y-2.5">
              <div className="skeleton-shimmer h-3.5 w-full rounded-full bg-[var(--muted)]" />
              <div className="skeleton-shimmer h-3.5 w-5/6 rounded-full bg-[var(--muted)]" />
              <div className="skeleton-shimmer h-3.5 w-4/6 rounded-full bg-[var(--muted)]" />
              <div className="skeleton-shimmer h-3.5 w-full rounded-full bg-[var(--muted)]" />
              <div className="skeleton-shimmer h-3.5 w-3/6 rounded-full bg-[var(--muted)]" />
            </div>
          )}

          {summaryError && !isSummaryLoading && (
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-400">
                {summaryError}
              </p>
              <button
                onClick={() => {
                  setSummaryCache((prev) => ({
                    ...prev,
                    [activeTab]: null,
                  }));
                  loadSummaryContent(activeTab);
                }}
                className="focus-ring mt-2 text-sm font-medium text-red-600 underline transition-colors duration-150 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}

          {currentSummaryContent && !isSummaryLoading && !summaryError && (
            <div className="fade-in">
              <div className="prose prose-sm max-w-none text-[var(--foreground)] prose-headings:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-p:leading-relaxed dark:prose-invert">
                <ReactMarkdown>{currentSummaryContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transcript tab — uses TranscriptViewer with search + seek */}
      {activeTab === "transcript" && (
        <div className="flex-1 overflow-y-auto p-4">
          {summaryLoading && (
            <div className="flex h-40 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
                <p className="text-sm text-[var(--muted-foreground)]">Loading transcript...</p>
              </div>
            </div>
          )}
          {summaryError && !summaryLoading && (
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-400">{summaryError}</p>
              <button
                onClick={() => {
                  setSummaryCache((prev) => ({ ...prev, transcript: null }));
                  loadSummaryContent("transcript");
                }}
                className="focus-ring mt-2 text-sm font-medium text-red-600 underline transition-colors duration-150 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}
          {transcriptSegments.length > 0 && !summaryLoading && !summaryError && (
            <TranscriptViewer
              segments={transcriptSegments}
              onSeek={handleSeek}
              currentTime={currentTime}
            />
          )}
        </div>
      )}

      {/* Flashcards tab — kept mounted to preserve state across tab switches */}
      <div className={`flex-1 overflow-y-auto p-4 ${activeTab === "flashcards" ? "" : "hidden"}`}>
        <FlashcardViewer videoId={videoId} prefetchedFlashcards={prefetchData.flashcards} language={language} />
      </div>

      {/* Topics tab — kept mounted to preserve state across tab switches */}
      <div className={`flex-1 overflow-y-auto p-4 ${activeTab === "topics" ? "" : "hidden"}`}>
        <TopicsList videoId={videoId} onSeek={handleSeek} prefetchedTopics={prefetchData.topics} language={language} />
      </div>
    </div>
  );
}
