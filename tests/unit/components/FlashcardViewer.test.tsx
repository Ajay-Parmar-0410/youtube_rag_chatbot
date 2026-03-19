import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FlashcardViewer from "@/components/FlashcardViewer";

// Mock rag-client
vi.mock("@/lib/rag-client", () => ({
  fetchFlashcards: vi.fn(),
}));

import { fetchFlashcards } from "@/lib/rag-client";

const MOCK_FLASHCARDS = {
  flashcards: [
    { question: "What is React?", answer: "A UI library", difficulty: "easy" as const },
    { question: "What is JSX?", answer: "JavaScript XML syntax", difficulty: "medium" as const },
    { question: "What is a hook?", answer: "A function for state/effects", difficulty: "hard" as const },
  ],
  video_id: "abc12345678",
};

describe("FlashcardViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state without video", () => {
    render(<FlashcardViewer videoId="" />);
    expect(screen.getByText("Load a video to generate flashcards.")).toBeInTheDocument();
  });

  it("shows generate prompt with video", () => {
    render(<FlashcardViewer videoId="abc12345678" />);
    expect(screen.getByText(/Click "Generate"/)).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
  });

  it("generates and displays flashcards", async () => {
    (fetchFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: MOCK_FLASHCARDS,
    });

    render(<FlashcardViewer videoId="abc12345678" />);
    fireEvent.click(screen.getByText("Generate"));

    expect(await screen.findByText("What is React?")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("easy")).toBeInTheDocument();
  });

  it("navigates between cards", async () => {
    (fetchFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: MOCK_FLASHCARDS,
    });

    render(<FlashcardViewer videoId="abc12345678" />);
    fireEvent.click(screen.getByText("Generate"));

    await screen.findByText("What is React?");

    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("What is JSX?")).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("What is React?")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("shows error on failure", async () => {
    (fetchFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Service unavailable",
    });

    render(<FlashcardViewer videoId="abc12345678" />);
    fireEvent.click(screen.getByText("Generate"));

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  });
});
