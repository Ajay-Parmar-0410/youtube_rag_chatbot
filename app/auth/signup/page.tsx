"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
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
    const result = await signUp(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="mx-auto mt-20 max-w-sm px-4 text-center">
        <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Check your email
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account.
        </p>
        <Link
          href="/auth/login"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-20 max-w-sm px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Sign up
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Min. 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isSubmitting ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
