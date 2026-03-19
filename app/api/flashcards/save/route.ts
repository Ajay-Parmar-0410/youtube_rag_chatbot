import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ApiResponse } from "@/types/api";

interface FlashcardRow {
  readonly id: string;
  readonly user_id: string;
  readonly video_id: string;
  readonly question: string;
  readonly answer: string;
  readonly difficulty: string;
  readonly created_at: string;
}

interface SaveFlashcardInput {
  readonly question: string;
  readonly answer: string;
  readonly difficulty: string;
}

function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** POST: Save flashcards for a video */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<readonly FlashcardRow[]>>> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { videoId, flashcards } = body;

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { success: false, error: "Flashcards array is required." },
        { status: 400 },
      );
    }

    // Delete existing flashcards for this video (replace, not append)
    await supabase
      .from("flashcards")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", videoId as string);

    // Insert new flashcards
    const rows = (flashcards as readonly SaveFlashcardInput[]).map((fc) => ({
      user_id: user.id,
      video_id: videoId as string,
      question: fc.question,
      answer: fc.answer,
      difficulty: fc.difficulty,
    }));

    const { data, error } = await supabase
      .from("flashcards")
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data as readonly FlashcardRow[],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** GET: Load saved flashcards for a video */
export async function GET(
  request: Request,
): Promise<NextResponse<ApiResponse<readonly FlashcardRow[]>>> {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "A valid YouTube video ID is required." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .eq("video_id", videoId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []) as readonly FlashcardRow[],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
