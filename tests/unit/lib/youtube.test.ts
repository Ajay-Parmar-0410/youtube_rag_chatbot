import { describe, it, expect } from "vitest";
import { extractVideoId, getEmbedUrl, getThumbnailUrl } from "@/lib/youtube";

describe("extractVideoId", () => {
  it("extracts from standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts from short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts from embed URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts from shorts URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts from URL with extra params", () => {
    expect(
      extractVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&t=42"
      )
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts from URL without protocol", () => {
    expect(extractVideoId("youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("returns null for empty string", () => {
    expect(extractVideoId("")).toBeNull();
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractVideoId("https://www.google.com")).toBeNull();
  });

  it("returns null for invalid video ID", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(
      extractVideoId("  https://youtu.be/dQw4w9WgXcQ  ")
    ).toBe("dQw4w9WgXcQ");
  });
});

describe("getEmbedUrl", () => {
  it("returns correct embed URL", () => {
    expect(getEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });
});

describe("getThumbnailUrl", () => {
  it("returns correct thumbnail URL", () => {
    expect(getThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });
});
