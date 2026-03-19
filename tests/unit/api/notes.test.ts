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

describe("Notes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/notes", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const { GET } = await import("@/app/api/notes/route");
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/authentication required/i);
    });

    it("returns notes for authenticated user", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "note-1", content: "test note" }],
              error: null,
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/notes/route");
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe("POST /api/notes", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const { POST } = await import("@/app/api/notes/route");
      const request = new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "test123abcd", content: "note" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("returns 400 for missing fields", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      const { POST } = await import("@/app/api/notes/route");
      const request = new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
