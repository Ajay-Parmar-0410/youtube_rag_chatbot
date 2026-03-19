"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useAuth } from "@/components/AuthProvider";
import { useVideoPlayer, formatTimestamp } from "@/lib/youtube-player";
import { Timestamp } from "@/lib/tiptap-timestamp";
import { exportNotesToPdf } from "@/lib/pdf-export";
import { fetchVideoTitle } from "@/lib/youtube";
import NotesToolbar from "@/components/NotesToolbar";

interface NotesEditorProps {
  readonly videoId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NoteData {
  readonly id: string;
  readonly content: string;
}

/* ------------------------------------------------------------------ */
/* Helper: migrate plain-text notes to TipTap JSON                     */
/* ------------------------------------------------------------------ */
function migrateToTipTapJson(raw: string): object | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "doc") return parsed;
    return null;
  } catch {
    /* Plain text — wrap each line in a paragraph */
    const lines = raw.split("\n");
    return {
      type: "doc",
      content: lines.map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
    };
  }
}

/* ------------------------------------------------------------------ */
/* NotesEditor component                                               */
/* ------------------------------------------------------------------ */
export default function NotesEditor({ videoId }: NotesEditorProps) {
  const { user } = useAuth();
  const { player, isReady: playerReady } = useVideoPlayer();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasContent, setHasContent] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  /* ---- TipTap editor setup ---- */
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TiptapImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder:
          "Start taking notes... timestamps auto-added on Enter",
      }),
      Timestamp.configure({
        onTimestampClick: (seconds: number) => {
          player?.seekTo(seconds);
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none outline-none min-h-[200px] p-4",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey && playerReady && player) {
          /* Insert timestamp at start of new line */
          const seconds = player.getCurrentTime();
          const display = formatTimestamp(seconds);

          /* Let TipTap handle the Enter, then insert timestamp */
          setTimeout(() => {
            editor
              ?.chain()
              .focus()
              .insertTimestamp({ seconds, display })
              .insertContent(" ")
              .run();
          }, 0);

          return false; /* Let default Enter behavior happen first */
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      setHasContent(!ed.isEmpty);
      setSaveStatus("idle");
      if (!user) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveNote(JSON.stringify(ed.getJSON()));
      }, 2000);
    },
  });

  /* ---- Update timestamp click handler when player changes ---- */
  useEffect(() => {
    if (!editor) return;
    editor.extensionManager.extensions.forEach((ext) => {
      if (ext.name === "timestamp" && ext.options) {
        ext.options.onTimestampClick = (seconds: number) => {
          player?.seekTo(seconds);
        };
      }
    });
  }, [editor, player]);

  /* ---- Load existing note ---- */
  useEffect(() => {
    if (!videoId || !user) {
      editor?.commands.clearContent();
      setNoteId(null);
      setSaveStatus("idle");
      return;
    }

    let cancelled = false;

    async function loadNote() {
      try {
        const response = await fetch("/api/notes");
        if (!response.ok) return;
        const body = await response.json();
        if (cancelled || !body.success) return;

        const existing = body.data?.find(
          (n: { video_id: string }) => n.video_id === videoId,
        );
        if (existing) {
          const content = migrateToTipTapJson(existing.content);
          if (content) {
            editor?.commands.setContent(content);
          } else {
            editor?.commands.setContent(existing.content);
          }
          setNoteId(existing.id);
        } else {
          editor?.commands.clearContent();
          setNoteId(null);
        }
      } catch {
        /* Silently fail */
      }
    }

    loadNote();
    return () => {
      cancelled = true;
    };
  }, [videoId, user, editor]);

  /* Reset on logout */
  useEffect(() => {
    if (!user) {
      editor?.commands.clearContent();
      setNoteId(null);
    }
  }, [user, editor]);

  /* Cleanup debounce */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ---- Save note ---- */
  const saveNote = useCallback(
    async (jsonContent: string) => {
      if (!user || !videoId) return;
      setSaveStatus("saving");

      try {
        if (noteId) {
          const response = await fetch(`/api/notes/${noteId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: jsonContent }),
          });
          setSaveStatus(response.ok ? "saved" : "error");
        } else {
          const videoTitle = await fetchVideoTitle(videoId);
          const response = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId, content: jsonContent, videoTitle }),
          });
          if (response.ok) {
            const body = await response.json();
            if (body.success && body.data) {
              setNoteId((body.data as NoteData).id);
            }
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [user, videoId, noteId],
  );

  /* ---- Manual save ---- */
  const handleManualSave = useCallback(() => {
    if (!editor) return;
    saveNote(JSON.stringify(editor.getJSON()));
  }, [editor, saveNote]);

  /* ---- Screenshot via server-side frame extraction ---- */
  /* Tries: 1) server-side storyboard frame  2) fetch thumbnail as base64  3) direct thumbnail URL */
  const handleScreenshot = useCallback(async () => {
    if (!editor || !player || !videoId) return;

    const seconds = player.getCurrentTime();
    const display = formatTimestamp(seconds);

    setScreenshotLoading(true);

    const insertImage = (src: string) => {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "image",
            attrs: { src, alt: `Screenshot at ${display}` },
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                marks: [{ type: "italic" }],
                text: `Screenshot at [${display}]`,
              },
            ],
          },
        ])
        .run();
    };

    try {
      /* Method 1: Server-side frame extraction */
      const response = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, timestamp: seconds }),
      });

      const body = await response.json();
      if (body.success && body.data?.image) {
        insertImage(body.data.image);
        return;
      }
    } catch {
      /* Server failed, try fallback */
    }

    try {
      /* Method 2: Fetch YouTube thumbnail as base64 via canvas */
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = thumbUrl;

      const base64 = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("no ctx")); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg"));
        };
        img.onerror = () => reject(new Error("thumbnail load failed"));
      });

      insertImage(base64);
    } catch {
      /* Method 3: Direct thumbnail URL */
      const directUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      insertImage(directUrl);
    } finally {
      setScreenshotLoading(false);
    }
  }, [editor, player, videoId]);

  /* ---- Export to Markdown ---- */
  const handleExportMd = useCallback(() => {
    if (!editor) return;

    /* Simple markdown conversion from TipTap text */
    const text = editor.getText();
    const blob = new Blob([text], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notes-${videoId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [editor, videoId]);

  /* ---- Export to PDF ---- */
  const handleExportPdf = useCallback(async () => {
    const el = editorContainerRef.current?.querySelector(".ProseMirror");
    if (!el || !videoId) return;
    await exportNotesToPdf(el as HTMLElement, videoId);
  }, [videoId]);

  /* ---- Empty state ---- */
  if (!videoId) {
    return (
      <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm ring-1 ring-[var(--card-border)] lg:h-[calc(100vh-6rem)]">
        <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
          Notes
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Load a video to start taking notes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl bg-[var(--card)] shadow-sm ring-1 ring-[var(--card-border)] lg:h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Notes
          </h2>
          <SaveStatusBadge status={saveStatus} isLoggedIn={!!user} />
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={handleManualSave}
              disabled={!hasContent || saveStatus === "saving"}
              className="rounded-full bg-[var(--accent)] px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          )}
          <button
            onClick={handleExportMd}
            disabled={!hasContent}
            className="rounded-full bg-[var(--muted)] px-3.5 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            .md
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!hasContent}
            className="rounded-full bg-[var(--muted)] px-3.5 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            .pdf
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <NotesToolbar
        editor={editor}
        onScreenshot={handleScreenshot}
        screenshotDisabled={!playerReady || screenshotLoading}
      />

      {/* Editor */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save status badge (unchanged from original)                         */
/* ------------------------------------------------------------------ */
function SaveStatusBadge({
  status,
  isLoggedIn,
}: {
  readonly status: SaveStatus;
  readonly isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <span className="text-xs text-[var(--muted-foreground)]">
        Sign in to save
      </span>
    );
  }

  switch (status) {
    case "saving":
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Saving...
        </span>
      );
    case "saved":
      return (
        <span className="text-xs text-green-600 dark:text-green-400">
          Saved
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-red-600 dark:text-red-400">
          Save failed
        </span>
      );
    default:
      return null;
  }
}
