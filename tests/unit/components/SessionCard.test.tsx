import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SessionCard from "@/components/SessionCard";

describe("SessionCard", () => {
  const session = {
    id: "session-1",
    videoId: "abc12345678",
    videoTitle: "Test Video",
    messageCount: 5,
    createdAt: "2026-03-15T10:00:00Z",
  };

  it("renders video title", () => {
    render(<SessionCard {...session} />);
    expect(screen.getByText("Test Video")).toBeInTheDocument();
  });

  it("renders message count", () => {
    render(<SessionCard {...session} />);
    expect(screen.getByText(/5 messages/i)).toBeInTheDocument();
  });

  it("links to home with video loaded", () => {
    render(<SessionCard {...session} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/?v=abc12345678");
  });
});
