export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--muted)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
      </div>
    </div>
  );
}
