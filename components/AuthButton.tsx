"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";

interface AuthButtonProps {
  readonly user: { readonly email?: string } | null;
  readonly onSignOut: () => void;
}

export default function AuthButton({ user, onSignOut }: AuthButtonProps) {
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="btn-press focus-ring flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
      >
        <LogIn size={16} />
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "U").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-muted)] text-sm font-medium text-[var(--accent)]">
        {initial}
      </div>
      <button
        onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="focus-ring rounded-lg p-2 text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
