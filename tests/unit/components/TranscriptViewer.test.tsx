import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TranscriptViewer from "@/components/TranscriptViewer";

const MOCK_SEGMENTS = [
  { text: "Hello everyone, welcome to the video.", start: 0, duration: 5 },
  { text: "Today we talk about React hooks.", start: 5, duration: 5 },
  { text: "Let's start with useState.", start: 10, duration: 5 },
  { text: "Next up is useEffect.", start: 15, duration: 5 },
];

describe("TranscriptViewer", () => {
  it("shows empty state when no segments", () => {
    render(<TranscriptViewer segments={[]} />);
    expect(screen.getByText("No transcript available.")).toBeInTheDocument();
  });

  it("renders all segments", () => {
    render(<TranscriptViewer segments={MOCK_SEGMENTS} />);
    expect(screen.getByText("Hello everyone, welcome to the video.")).toBeInTheDocument();
    expect(screen.getByText("Today we talk about React hooks.")).toBeInTheDocument();
    expect(screen.getByText("4 segments")).toBeInTheDocument();
  });

  it("renders timestamps", () => {
    render(<TranscriptViewer segments={MOCK_SEGMENTS} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0:05")).toBeInTheDocument();
    expect(screen.getByText("0:10")).toBeInTheDocument();
    expect(screen.getByText("0:15")).toBeInTheDocument();
  });

  it("filters segments by search", () => {
    render(<TranscriptViewer segments={MOCK_SEGMENTS} />);
    const searchInput = screen.getByPlaceholderText("Search transcript...");

    fireEvent.change(searchInput, { target: { value: "hooks" } });

    expect(screen.getByText(/hooks/)).toBeInTheDocument();
    expect(screen.queryByText("Hello everyone, welcome to the video.")).not.toBeInTheDocument();
    expect(screen.getByText("1 segment")).toBeInTheDocument();
  });

  it("shows no results message for unmatched search", () => {
    render(<TranscriptViewer segments={MOCK_SEGMENTS} />);
    const searchInput = screen.getByPlaceholderText("Search transcript...");

    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText(/No segments matching/)).toBeInTheDocument();
  });

  it("calls onSeek when segment is clicked", () => {
    const onSeek = vi.fn();
    render(<TranscriptViewer segments={MOCK_SEGMENTS} onSeek={onSeek} />);

    fireEvent.click(screen.getByText("Today we talk about React hooks."));
    expect(onSeek).toHaveBeenCalledWith(5);
  });
});
