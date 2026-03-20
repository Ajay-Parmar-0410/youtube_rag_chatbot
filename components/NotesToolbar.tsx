"use client";

import type { Editor } from "@tiptap/react";
import { Camera } from "lucide-react";

interface NotesToolbarProps {
  readonly editor: Editor | null;
  readonly onScreenshot?: () => void;
  readonly screenshotDisabled?: boolean;
}

interface ToolbarButtonProps {
  readonly onClick: () => void;
  readonly isActive?: boolean;
  readonly disabled?: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`focus-ring rounded-lg p-2 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        isActive
          ? "bg-[var(--accent-muted)] text-[var(--accent)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function NotesToolbar({
  editor,
  onScreenshot,
  screenshotDisabled = false,
}: NotesToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--card-border)] px-3 py-1.5 overflow-x-auto">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>

      <div className="w-px h-5 bg-[var(--border)]" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading"
      >
        H
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zm0 5A.75.75 0 016.75 9h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 9.75zm0 5a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM3.5 4.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 5a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
            clipRule="evenodd"
          />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Task list"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </ToolbarButton>

      <div className="w-px h-5 bg-[var(--border)]" />

      <ToolbarButton
        onClick={() => onScreenshot?.()}
        disabled={screenshotDisabled}
        title="Screenshot"
      >
        <Camera size={16} />
      </ToolbarButton>
    </div>
  );
}
