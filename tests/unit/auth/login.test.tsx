import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "@/app/auth/login/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
vi.mock("@/lib/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

function getSubmitButton() {
  return screen.getByRole("button", { name: /log in/i });
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(getSubmitButton()).toBeInTheDocument();
  });

  it("shows error for empty email", async () => {
    render(<LoginPage />);
    fireEvent.click(getSubmitButton());
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it("shows error for short password", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "short" },
    });
    fireEvent.click(getSubmitButton());
    await waitFor(() => {
      expect(
        screen.getByText(/password must be at least 8 characters/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error state from auth failure", async () => {
    mockSignIn.mockResolvedValue({ user: null, error: "Invalid credentials" });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(getSubmitButton());
    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("redirects on successful login", async () => {
    mockSignIn.mockResolvedValue({
      user: { email: "test@example.com" },
      error: null,
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(getSubmitButton());
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("has link to signup page", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
  });
});
