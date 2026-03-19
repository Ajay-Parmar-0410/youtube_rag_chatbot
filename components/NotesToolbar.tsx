"use client";

import type { Editor } from "@tiptap/react";

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
      className={`rounded px-2 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        isActive
          ? "bg-[var(--accent)] text-white"
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
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--card-border)]" />

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
        title="Bullet List"
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
        title="Checkbox List"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--card-border)]" />

      <ToolbarButton
        onClick={() => onScreenshot?.()}
        disabled={screenshotDisabled}
        title="Insert Screenshot"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </ToolbarButton>
    </div>
  );
}
