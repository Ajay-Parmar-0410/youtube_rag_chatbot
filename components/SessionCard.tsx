import Link from "next/link";

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
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
    >
      <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
        {videoTitle ?? videoId}
      </h3>
      <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
        <span>{messageCount} messages</span>
        <span>{formattedDate}</span>
      </div>
    </Link>
  );
}
