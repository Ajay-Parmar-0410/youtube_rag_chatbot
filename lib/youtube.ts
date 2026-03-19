import { YOUTUBE_URL_PATTERNS } from "./constants";

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // Handle URLs with extra query params (e.g., &list=, &t=)
  try {
    const parsed = new URL(trimmed);
    const v = parsed.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) {
      return v;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

export function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function fetchVideoTitle(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch {
    return null;
  }
}

export function slugifyTitle(title: string, maxLength: number = 40): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");

  // If slug is empty (e.g. all non-ASCII title), return empty so caller falls back
  return slug || "";
}
