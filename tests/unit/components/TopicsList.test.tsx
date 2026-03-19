import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TopicsList from "@/components/TopicsList";

vi.mock("@/lib/rag-client", () => ({
  fetchTopics: vi.fn(),
}));

import { fetchTopics } from "@/lib/rag-client";

const MOCK_TOPICS = {
  topics: [
    { topic: "Introduction", description: "Overview of the topic", timestamp_start: 0 },
    { topic: "Core Concepts", description: "Main ideas explained", timestamp_start: 120 },
    { topic: "Advanced Usage", description: "Deep dive into details", timestamp_start: 360 },
  ],
  video_id: "abc12345678",
};

describe("TopicsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state without video", () => {
    render(<TopicsList videoId="" />);
    expect(screen.getByText("Load a video to extract key topics.")).toBeInTheDocument();
  });

  it("shows extract prompt with video", () => {
    render(<TopicsList videoId="abc12345678" />);
    expect(screen.getByText(/Click "Extract Topics"/)).toBeInTheDocument();
  });

  it("extracts and displays topics", async () => {
    (fetchTopics as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: MOCK_TOPICS,
    });

    render(<TopicsList videoId="abc12345678" />);
    fireEvent.click(screen.getByText("Extract Topics"));

    expect(await screen.findByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Core Concepts")).toBeInTheDocument();
    expect(screen.getByText("Advanced Usage")).toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("6:00")).toBeInTheDocument();
  });

  it("calls onSeek when timestamp is clicked", async () => {
    const onSeek = vi.fn();
    (fetchTopics as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: MOCK_TOPICS,
    });

    render(<TopicsList videoId="abc12345678" onSeek={onSeek} />);
    fireEvent.click(screen.getByText("Extract Topics"));

    await screen.findByText("Introduction");
    fireEvent.click(screen.getByText("2:00"));
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it("shows error on failure", async () => {
    (fetchTopics as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Failed to extract",
    });

    render(<TopicsList videoId="abc12345678" />);
    fireEvent.click(screen.getByText("Extract Topics"));

    expect(await screen.findByText("Failed to extract")).toBeInTheDocument();
  });
});
