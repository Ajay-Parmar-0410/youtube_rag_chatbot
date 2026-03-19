import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ApiResponse } from "@/types/api";

interface ChatSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly video_id: string;
  readonly video_title: string | null;
  readonly created_at: string;
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(): Promise<
  NextResponse<ApiResponse<ChatSessionRow[]>>
> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ChatSessionRow[],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<ChatSessionRow>>> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, videoTitle } = body;

    if (typeof videoId !== "string" || !videoId.trim()) {
      return NextResponse.json(
        { success: false, error: "videoId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        video_id: videoId,
        video_title: typeof videoTitle === "string" ? videoTitle : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: data as ChatSessionRow },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
