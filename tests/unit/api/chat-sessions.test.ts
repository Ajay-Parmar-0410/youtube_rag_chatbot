import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

describe("Chat Sessions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/chat/sessions", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const { GET } = await import("@/app/api/chat/sessions/route");
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
    });

    it("returns sessions for authenticated user", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "session-1", video_id: "abc12345678" }],
              error: null,
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/chat/sessions/route");
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe("POST /api/chat/sessions", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const { POST } = await import("@/app/api/chat/sessions/route");
      const request = new Request("http://localhost/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "abc12345678" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("creates session for authenticated user", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "session-new", video_id: "abc12345678" },
              error: null,
            }),
          }),
        }),
      });

      const { POST } = await import("@/app/api/chat/sessions/route");
      const request = new Request("http://localhost/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "abc12345678" }),
      });
      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
    });
  });
});
