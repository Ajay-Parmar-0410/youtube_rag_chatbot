import { NextResponse, type NextRequest } from "next/server";
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

type RouteParams = { params: Promise<{ id: string }> };

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<NoteRow>>> {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: data as NoteRow });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<NoteRow>>> {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { content, videoTitle } = body;

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "content is required" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = { content };
    if (typeof videoTitle === "string") {
      updates.video_title = videoTitle;
    }

    const { data, error } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: data as NoteRow });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
