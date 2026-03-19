"use client";

import Link from "next/link";

interface AuthButtonProps {
  readonly user: { readonly email?: string } | null;
  readonly onSignOut: () => void;
}

export default function AuthButton({ user, onSignOut }: AuthButtonProps) {
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="rounded-full border border-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--muted-foreground)]">
        {user.email}
      </span>
      <button
        onClick={onSignOut}
        className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
      >
        Sign out
      </button>
    </div>
  );
}
