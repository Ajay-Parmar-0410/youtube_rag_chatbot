import { createBrowserClient } from "@/lib/supabase";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  return {
    user: data.user,
    error: error?.message ?? null,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User | null; error: string | null }> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return {
    user: data.user,
    error: error?.message ?? null,
  };
}

export async function signOut(): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const supabase = createBrowserClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}
