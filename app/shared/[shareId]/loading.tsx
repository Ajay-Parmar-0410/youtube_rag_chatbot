export default function SharedNoteLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-4">
        <div className="h-8 w-64 skeleton-shimmer rounded-lg bg-[var(--muted)]" />
        <div className="h-4 w-48 skeleton-shimmer rounded bg-[var(--muted)]" />
        <div className="mt-6 space-y-3">
          <div className="h-4 w-full skeleton-shimmer rounded bg-[var(--muted)]" />
          <div className="h-4 w-5/6 skeleton-shimmer rounded bg-[var(--muted)]" />
          <div className="h-4 w-4/6 skeleton-shimmer rounded bg-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}
