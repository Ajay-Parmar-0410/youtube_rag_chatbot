import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouTube RAG",
  description:
    "Watch YouTube videos and interact with their content via AI-powered summary, Q&A, and notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <AppHeader />
            <main>{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
