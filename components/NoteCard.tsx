import Link from "next/link";

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
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
    >
      <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
        {videoTitle ?? videoId}
      </h3>
      <p
        data-testid="note-preview"
        className="mb-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        {preview}
      </p>
      <time className="text-xs text-zinc-400 dark:text-zinc-500">
        {formattedDate}
      </time>
    </Link>
  );
}
