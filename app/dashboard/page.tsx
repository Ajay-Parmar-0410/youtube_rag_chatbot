"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import EmptyState from "@/components/EmptyState";
import NoteCard from "@/components/NoteCard";
import SessionCard from "@/components/SessionCard";

interface NoteRow {
  readonly id: string;
  readonly video_id: string;
  readonly video_title: string | null;
  readonly content: string;
  readonly updated_at: string;
}

interface SessionRow {
  readonly id: string;
  readonly video_id: string;
  readonly video_title: string | null;
  readonly created_at: string;
  readonly message_count?: number;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<readonly NoteRow[]>([]);
  const [sessions, setSessions] = useState<readonly SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [notesRes, sessionsRes] = await Promise.all([
          fetch("/api/notes"),
          fetch("/api/chat/sessions"),
        ]);

        if (!cancelled) {
          const notesBody = notesRes.ok ? await notesRes.json() : null;
          const sessionsBody = sessionsRes.ok
            ? await sessionsRes.json()
            : null;

          if (notesBody?.success) setNotes(notesBody.data);
          if (sessionsBody?.success) setSessions(sessionsBody.data);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-center text-zinc-500 dark:text-zinc-400">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Saved Notes
        </h2>
        {isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-6 w-6 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
            title="No saved notes"
            description="Load a video and start taking notes to see them here."
            action={{ label: "Go to home", onClick: () => router.push("/") }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                id={note.id}
                videoId={note.video_id}
                videoTitle={note.video_title}
                content={note.content}
                updatedAt={note.updated_at}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Chat History
        </h2>
        {isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading sessions...
          </p>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-6 w-6 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            }
            title="No chat sessions"
            description="Load a video and ask a question to see your history here."
            action={{ label: "Go to home", onClick: () => router.push("/") }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                id={session.id}
                videoId={session.video_id}
                videoTitle={session.video_title}
                messageCount={session.message_count ?? 0}
                createdAt={session.created_at}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
