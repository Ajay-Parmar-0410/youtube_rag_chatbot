"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="focus-ring rounded-lg p-2 text-[var(--muted-foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] hover:rotate-12"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title="Switch to light/dark mode"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
