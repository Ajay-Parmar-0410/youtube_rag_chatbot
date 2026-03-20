"use client";

import { useState, useCallback, useEffect } from "react";
import { Globe } from "lucide-react";

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
    <div className="flex items-center gap-1.5">
      <Globe size={14} className="text-[var(--muted-foreground)]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as OutputLanguage)}
        className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none transition-colors duration-150 focus:border-[var(--input-focus)] focus:shadow-[0_0_0_1px_var(--input-focus)]"
        aria-label="Output language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
}
