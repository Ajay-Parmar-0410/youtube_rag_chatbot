import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-[var(--muted-foreground)]">
          404
        </h1>
        <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
