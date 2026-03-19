import { createBrowserClient as createBrowser } from "@supabase/ssr";
import { createServerClient as createServer } from "@supabase/ssr";
import type { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function createBrowserClient() {
  return createBrowser(supabaseUrl, supabaseAnonKey);
}

export function createServerSupabaseClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  return createServer(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
