"use client";

import { useState, useCallback, useEffect } from "react";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Gujarati",
  "Hindi",
  "Arabic",
  "Chinese",
  "Japanese",
  "Portuguese",
  "Russian",
] as const;

export type OutputLanguage = (typeof LANGUAGES)[number];

const STORAGE_KEY = "yt-rag-language";

interface LanguageSelectorProps {
  readonly value: OutputLanguage;
  readonly onChange: (language: OutputLanguage) => void;
}

export function useLanguagePreference() {
  const [language, setLanguage] = useState<OutputLanguage>("English");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.includes(stored as OutputLanguage)) {
      setLanguage(stored as OutputLanguage);
    }
  }, []);

  const updateLanguage = useCallback((lang: OutputLanguage) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  return [language, updateLanguage] as const;
}

export default function LanguageSelector({
  value,
  onChange,
}: LanguageSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as OutputLanguage)}
      className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none transition-colors focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)]"
      aria-label="Output language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
  );
}
