export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 h-8 w-40 animate-pulse rounded-lg bg-[var(--muted)]" />

      <section className="mb-10">
        <div className="mb-4 h-6 w-32 animate-pulse rounded-lg bg-[var(--muted)]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-[var(--muted)]"
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 h-6 w-32 animate-pulse rounded-lg bg-[var(--muted)]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-[var(--muted)]"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
