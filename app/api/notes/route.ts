import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ApiResponse } from "@/types/api";

interface NoteRow {
  readonly id: string;
  readonly user_id: string;
  readonly video_id: string;
  readonly video_title: string | null;
  readonly content: string;
  readonly created_at: string;
  readonly updated_at: string;
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(): Promise<NextResponse<ApiResponse<NoteRow[]>>> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "GET: Authentication required" },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: `GET DB error: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data as NoteRow[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `GET catch: ${msg}` },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<NoteRow>>> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "POST: Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, content, videoTitle } = body;

    if (typeof videoId !== "string" || !videoId.trim()) {
      return NextResponse.json(
        { success: false, error: "POST: videoId is required" },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "POST: content is required" },
        { status: 400 },
      );
    }

    if (content.length > 50_000) {
      return NextResponse.json(
        { success: false, error: "POST: content too long" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        video_id: videoId,
        video_title: typeof videoTitle === "string" ? videoTitle : null,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: `POST DB error: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: data as NoteRow },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `POST catch: ${msg}` },
      { status: 500 },
    );
  }
}
