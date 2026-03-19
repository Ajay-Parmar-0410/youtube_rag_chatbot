import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ApiResponse } from "@/types/api";

interface ChatMessageRow {
  readonly id: string;
  readonly session_id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly created_at: string;
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
): Promise<NextResponse<ApiResponse<ChatMessageRow[]>>> {
  try {
    const { id: sessionId } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ChatMessageRow[],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<ChatMessageRow>>> {
  try {
    const { id: sessionId } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { role, content } = body;

    if (role !== "user" && role !== "assistant") {
      return NextResponse.json(
        { success: false, error: "role must be 'user' or 'assistant'" },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "content is required" },
        { status: 400 },
      );
    }

    if (content.length > 4000) {
      return NextResponse.json(
        { success: false, error: "content must be under 4000 characters" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: data as ChatMessageRow },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
