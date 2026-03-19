import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NoteCard from "@/components/NoteCard";

describe("NoteCard", () => {
  const note = {
    id: "note-1",
    videoId: "abc12345678",
    videoTitle: "Test Video Title",
    content:
      "This is a long note that should be truncated because it exceeds the preview character limit for display purposes in the card.",
    updatedAt: "2026-03-15T10:00:00Z",
  };

  it("renders video title", () => {
    render(<NoteCard {...note} />);
    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
  });

  it("renders content preview (truncated)", () => {
    render(<NoteCard {...note} />);
    const preview = screen.getByTestId("note-preview");
    expect(preview.textContent!.length).toBeLessThanOrEqual(103); // 100 + "..."
  });

  it("renders last updated date", () => {
    render(<NoteCard {...note} />);
    expect(screen.getByText(/mar/i)).toBeInTheDocument();
  });

  it("links to home with video loaded", () => {
    render(<NoteCard {...note} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/?v=abc12345678");
  });
});
