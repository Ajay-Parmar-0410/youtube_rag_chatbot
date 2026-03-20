"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push("/");
  }

  return (
    <div className="fade-in mx-auto mt-20 max-w-sm px-4">
      <div className="bg-[var(--card)] rounded-xl p-8 ring-1 ring-[var(--card-border)] shadow-lg">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <polygon points="10,8.5 16,12 10,15.5" fill="currentColor" />
          </svg>
          <span className="text-lg font-bold text-[var(--foreground)]">YouTube RAG</span>
        </div>

        <h1 className="mb-6 text-center text-2xl font-bold text-[var(--foreground)]">
          Log in
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-[var(--foreground)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--input-focus)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-[var(--foreground)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--input-focus)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-press focus-ring w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="focus-ring font-medium text-[var(--accent)] transition-colors duration-150 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
