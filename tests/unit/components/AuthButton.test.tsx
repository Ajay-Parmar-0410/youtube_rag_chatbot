import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthButton from "@/components/AuthButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("AuthButton", () => {
  it("shows login button when no user", () => {
    render(<AuthButton user={null} onSignOut={vi.fn()} />);
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows user email and logout when user present", () => {
    render(
      <AuthButton
        user={{ email: "test@example.com" }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it("calls onSignOut when logout clicked", () => {
    const onSignOut = vi.fn();
    render(
      <AuthButton
        user={{ email: "test@example.com" }}
        onSignOut={onSignOut}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
