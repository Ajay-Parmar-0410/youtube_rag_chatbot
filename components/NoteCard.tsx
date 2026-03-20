import Link from "next/link";
import { FileText } from "lucide-react";

interface NoteCardProps {
  readonly id: string;
  readonly videoId: string;
  readonly videoTitle: string | null;
  readonly content: string;
  readonly updatedAt: string;
}

function extractTextFromTipTap(raw: string): string {
  try {
    const doc = JSON.parse(raw);
    if (doc?.type !== "doc" || !Array.isArray(doc.content)) return raw;

    const texts: string[] = [];
    function walk(nodes: readonly unknown[]) {
      for (const node of nodes) {
        const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: { display?: string } };
        if (n.type === "text" && n.text) {
          texts.push(n.text);
        } else if (n.type === "timestamp" && n.attrs?.display) {
          texts.push(`[${n.attrs.display}]`);
        }
        if (Array.isArray(n.content)) {
          walk(n.content);
        }
      }
    }
    walk(doc.content);
    return texts.join(" ").trim() || raw;
  } catch {
    return raw;
  }
}

export default function NoteCard({
  videoId,
  videoTitle,
  content,
  updatedAt,
}: NoteCardProps) {
  const plainText = extractTextFromTipTap(content);
  const preview =
    plainText.length > 100 ? `${plainText.slice(0, 100)}...` : plainText;

  const formattedDate = new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/?v=${videoId}`}
      className="card-hover focus-ring block rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4 transition-all duration-200 hover:bg-[var(--surface-hover)]"
    >
      <h3 className="mb-1 flex items-center gap-1.5 font-medium text-[var(--foreground)]">
        <FileText size={14} className="shrink-0 text-[var(--muted-foreground)]" />
        {videoTitle ?? videoId}
      </h3>
      <p
        data-testid="note-preview"
        className="mb-2 text-sm text-[var(--muted-foreground)]"
      >
        {preview}
      </p>
      <time className="text-xs text-[var(--muted-foreground-2)]">
        {formattedDate}
      </time>
    </Link>
  );
}
