import { describe, it, expect } from "vitest";
import { validateYouTubeUrl, validateQuery } from "@/lib/validation";

describe("validateYouTubeUrl", () => {
  it("accepts valid YouTube URL", () => {
    const result = validateYouTubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(result.valid).toBe(true);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.error).toBeUndefined();
  });

  it("rejects empty string", () => {
    const result = validateYouTubeUrl("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("URL is required");
  });

  it("rejects non-YouTube URL", () => {
    const result = validateYouTubeUrl("https://www.google.com");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid YouTube URL");
  });

  it("rejects whitespace-only input", () => {
    const result = validateYouTubeUrl("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("URL is required");
  });
});

describe("validateQuery", () => {
  it("accepts valid question", () => {
    const result = validateQuery("What is this video about?");
    expect(result.valid).toBe(true);
  });

  it("rejects empty question", () => {
    const result = validateQuery("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Question is required");
  });

  it("rejects whitespace-only question", () => {
    const result = validateQuery("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Question is required");
  });

  it("rejects question exceeding max length", () => {
    const longQuestion = "a".repeat(1001);
    const result = validateQuery(longQuestion);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("under");
  });

  it("accepts question at max length", () => {
    const maxQuestion = "a".repeat(1000);
    const result = validateQuery(maxQuestion);
    expect(result.valid).toBe(true);
  });
});
