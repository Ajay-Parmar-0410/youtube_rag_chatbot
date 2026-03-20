"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import VideoPlayer, { VideoPlayerProvider } from "@/components/VideoPlayer";
import ReactMarkdown from "react-markdown";
import { useParams } from "next/navigation";

interface SharedNote {
  readonly video_id: string;
  readonly video_title: string | null;
  readonly content: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface PageState {
  readonly note: SharedNote | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

function parseNoteContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    // TipTap JSON — extract plain text
    if (parsed?.type === "doc" && Array.isArray(parsed.content)) {
      return extractTextFromTipTap(parsed.content);
    }
    return content;
  } catch {
    // Plain text or markdown
    return content;
  }
}

function extractTextFromTipTap(nodes: readonly Record<string, unknown>[]): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph" || node.type === "heading") {
      const text = extractInlineText(node.content as Record<string, unknown>[] | undefined);
      const level = (node.type === "heading" && node.attrs && typeof (node.attrs as Record<string, unknown>).level === "number")
        ? (node.attrs as Record<string, unknown>).level as number
        : 0;
      const prefix = level > 0 ? "#".repeat(level) + " " : "";
      lines.push(prefix + text);
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = node.content as Record<string, unknown>[] | undefined;
      if (items) {
        for (const item of items) {
          const itemContent = item.content as Record<string, unknown>[] | undefined;
          if (itemContent) {
            lines.push("- " + extractTextFromTipTap(itemContent));
          }
        }
      }
    } else if (node.type === "taskList") {
      const items = node.content as Record<string, unknown>[] | undefined;
      if (items) {
        for (const item of items) {
          const checked = item.attrs && (item.attrs as Record<string, unknown>).checked;
          const itemContent = item.content as Record<string, unknown>[] | undefined;
          const prefix = checked ? "- [x] " : "- [ ] ";
          lines.push(prefix + (itemContent ? extractTextFromTipTap(itemContent) : ""));
        }
      }
    }
  }
  return lines.join("\n\n");
}

function extractInlineText(nodes: readonly Record<string, unknown>[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text as string;
      if (n.type === "timestamp") {
        const attrs = n.attrs as Record<string, unknown> | undefined;
        return attrs?.display ? `[${attrs.display}]` : "";
      }
      return "";
    })
    .join("");
}

export default function SharedNotePage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const [state, setState] = useState<PageState>({
    note: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!shareId) return;

    async function loadSharedNote() {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("notes")
        .select("video_id, video_title, content, created_at, updated_at")
        .eq("share_id", shareId)
        .eq("is_shared", true)
        .single();

      if (error || !data) {
        setState({
          note: null,
          isLoading: false,
          error: "Shared note not found or link has been revoked.",
        });
        return;
      }

      setState({ note: data as SharedNote, isLoading: false, error: null });
    }

    loadSharedNote();
  }, [shareId]);

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--accent)]" />
          <p className="text-sm text-[var(--muted-foreground)]">
            Loading shared note...
          </p>
        </div>
      </div>
    );
  }

  if (state.error || !state.note) {
    return (
      <div className="fade-in flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="mx-4 max-w-md rounded-xl bg-[var(--card)] p-8 text-center shadow-sm ring-1 ring-[var(--card-border)]">
          <h1 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
            Note Not Found
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {state.error ?? "This shared note does not exist."}
          </p>
          <a
            href="/"
            className="btn-press focus-ring mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  const noteContent = parseNoteContent(state.note.content);
  const updatedDate = new Date(state.note.updated_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <VideoPlayerProvider videoId={state.note.video_id}>
      <div className="fade-in mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
              Shared Note
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {updatedDate}
            </span>
          </div>
          {state.note.video_title && (
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              {state.note.video_title}
            </h1>
          )}
        </div>

        {/* Video */}
        <div className="mb-6">
          <VideoPlayer videoId={state.note.video_id} />
        </div>

        {/* Note content (read-only) */}
        <div className="rounded-xl bg-[var(--card)] p-6 shadow-sm ring-1 ring-[var(--card-border)]">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            Notes
          </h2>
          <div className="prose prose-sm max-w-none text-[var(--foreground)] prose-headings:text-[var(--foreground)] prose-strong:text-[var(--foreground)] dark:prose-invert">
            <ReactMarkdown>{noteContent}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          This is a read-only shared note.{" "}
          <a href="/" className="text-[var(--accent)] transition-colors duration-150 hover:underline">
            Create your own notes
          </a>
        </p>
      </div>
    </VideoPlayerProvider>
  );
}
