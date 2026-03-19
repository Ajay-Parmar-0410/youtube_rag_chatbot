"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import AuthButton from "@/components/AuthButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-600 sm:h-6 sm:w-6" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <h1 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
              YouTube RAG
            </h1>
          </Link>
          {user && (
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:px-3 sm:py-1.5 sm:text-sm"
              >
                Dashboard
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <AuthButton
            user={user ? { email: user.email } : null}
            onSignOut={signOut}
          />
        </div>
      </div>
    </header>
  );
}
