import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { ApiResponse } from "@/types/api";

type RouteParams = { params: Promise<{ id: string }> };

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** POST: Generate a share link for a note */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<{ shareId: string }>>> {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Check the note belongs to the user
    const { data: note, error: fetchError } = await supabase
      .from("notes")
      .select("id, user_id, share_id, is_shared")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !note) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 },
      );
    }

    // If already shared, return existing share_id
    if (note.is_shared && note.share_id) {
      return NextResponse.json({
        success: true,
        data: { shareId: note.share_id },
      });
    }

    // Generate new share_id
    const shareId = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from("notes")
      .update({ share_id: shareId, is_shared: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to share note" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { shareId } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** DELETE: Revoke sharing for a note */
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
      .update({ is_shared: false, share_id: null })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to revoke share" },
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
