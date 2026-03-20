import Link from "next/link";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="fade-in flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="mb-2 text-7xl font-black text-[var(--muted-foreground)]">
          404
        </h1>
        <Search size={32} className="mx-auto mb-4 text-[var(--muted-foreground-2)]" />
        <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-press focus-ring rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
