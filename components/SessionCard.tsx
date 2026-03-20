import Link from "next/link";
import { MessageCircle } from "lucide-react";

interface SessionCardProps {
  readonly id: string;
  readonly videoId: string;
  readonly videoTitle: string | null;
  readonly messageCount: number;
  readonly createdAt: string;
}

export default function SessionCard({
  videoId,
  videoTitle,
  messageCount,
  createdAt,
}: SessionCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
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
        <MessageCircle size={14} className="shrink-0 text-[var(--muted-foreground)]" />
        {videoTitle ?? videoId}
      </h3>
      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground-2)]">
        <span>{messageCount} messages</span>
        <span>{formattedDate}</span>
      </div>
    </Link>
  );
}
