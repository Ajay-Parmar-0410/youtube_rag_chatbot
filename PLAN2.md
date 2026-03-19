# Smart Notes Feature — Implementation Plan

## Overview

Replace the plain textarea notes editor with a professional, timestamp-linked, rich-text notes system with screenshot capture and PDF export.

## Current State

- `NotesEditor.tsx` — plain textarea, auto-save to Supabase, markdown export
- `VideoPlayer.tsx` — YouTube iframe embed
- Notes panel sits on the right side (sticky, full height)
- Auth via Supabase (optional)
- Layout: Video + ContentPanel (Q&A/Summary tabs) on left, Notes on right

---

## Feature Requirements

### 1. Auto-Timestamp on New Line
- When user presses Enter, auto-insert `[3:42]` (current video time) at start of new line
- Clicking a timestamp in notes jumps the video to that point
- Requires YouTube IFrame Player API to get `getCurrentTime()`
- Need to refactor VideoPlayer to use YT Player API instead of plain iframe

### 2. Screenshot Capture
- Camera button captures current video frame, inserts inline in notes
- **Cross-origin problem**: YouTube iframe cannot be captured via canvas
- **Solution**: Server-side frame extraction using `yt-dlp` + `ffmpeg`
  - Send `videoId + timestamp` to backend API
  - Backend downloads frame at that timestamp via yt-dlp/ffmpeg
  - Returns image as base64 or URL
  - Insert into notes as inline image
- **Alternative (simpler MVP)**: Use YouTube thumbnail sprites (frames every few seconds)
  - Less accurate but zero backend cost
  - URL pattern: `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg` (static)
  - Or use storyboard thumbnails for approximate frames

### 3. Mini Formatting Toolbar
- 5-6 buttons: **B**, *I*, List, Checkbox, Heading, Camera (screenshot)
- Clean, minimal design matching YouTube aesthetic
- Positioned above the editor area

### 4. Rich Text Editor (TipTap)
- Replace textarea with TipTap editor
- Extensions needed:
  - StarterKit (headings, bold, italic, lists, code)
  - TaskList + TaskItem (checkboxes)
  - Image (inline screenshots)
  - Placeholder
  - CharacterCount (optional)
- Support markdown shortcuts (e.g., `# ` for heading, `- ` for list)
- Custom extension for timestamp nodes (clickable, styled)

### 5. PDF Export
- Export notes as formatted PDF with:
  - Video title at top (fetched via oEmbed API)
  - Video URL
  - Timestamps as styled markers
  - Screenshots embedded inline
  - All formatting preserved
- Library: `@react-pdf/renderer` or `jspdf` + `html2canvas`
- Recommended: `html2canvas` + `jspdf` (render the TipTap editor content to PDF)

### 6. Screenshot Annotation
- After capturing screenshot, user can add caption below it
- In PDF, shows as image + caption text

---

## Technical Architecture

### Screenshot Approach Decision

| Approach | Accuracy | Cost | Complexity | Recommendation |
|----------|----------|------|------------|----------------|
| YouTube thumbnail URL | Low (static) | Free | Simple | MVP fallback |
| YouTube storyboard sprites | Medium (~2s) | Free | Medium | Good for MVP |
| yt-dlp + ffmpeg server-side | Exact frame | Free (CPU) | High | Best quality |
| Screen capture API | Requires permission | Free | Medium | Requires user prompt |

**Recommended for MVP**: YouTube storyboard sprites (approximate frames, no backend needed)
**Recommended for production**: Server-side yt-dlp + ffmpeg extraction

### Video Player API Integration

Current VideoPlayer uses a plain `<iframe>`. Need to switch to YouTube IFrame Player API:

```typescript
// Load YT API script
// Create player instance with onReady, onStateChange
// Expose getCurrentTime() to parent via ref or context
// VideoPlayer provides: play, pause, seekTo, getCurrentTime
```

### Data Model

Notes content stored as TipTap JSON (not plain text):
```typescript
interface NoteContent {
  type: "doc";
  content: TipTapNode[];
}

interface TimestampNode {
  type: "timestamp";
  attrs: { seconds: number; display: string };
}

interface ScreenshotNode {
  type: "image";
  attrs: { src: string; alt: string; caption?: string };
}
```

Supabase `notes` table already has `content TEXT` — store as JSON string.

---

## Implementation Phases

### Phase A: Video Player API (Foundation)
**Files**: `components/VideoPlayer.tsx`, new `lib/youtube-player.ts`

1. Replace plain iframe with YouTube IFrame Player API
2. Create `VideoPlayerContext` to share player state across components
3. Expose methods: `getCurrentTime()`, `seekTo(seconds)`, `getPlayerState()`
4. Ensure backward compatibility (still renders the video the same way)

**Packages**: None (YouTube IFrame API loads via script tag)

### Phase B: TipTap Rich Text Editor
**Files**: `components/NotesEditor.tsx` (rewrite), new `components/NotesToolbar.tsx`

1. Install TipTap packages
2. Create TipTap editor with extensions: StarterKit, TaskList, TaskItem, Image, Placeholder
3. Create formatting toolbar component
4. Wire up auto-save (debounced, same as current)
5. Store content as TipTap JSON in Supabase
6. Migration: handle existing plain-text notes (wrap in paragraph nodes)

**Packages**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`

### Phase C: Timestamp Integration
**Files**: `components/NotesEditor.tsx`, new `lib/tiptap-timestamp.ts`

1. Create custom TipTap `Timestamp` node extension
2. On Enter key, insert timestamp node with current video time
3. Style timestamps as clickable chips/badges
4. On click, call `seekTo(seconds)` via VideoPlayerContext
5. Render timestamps in format `[M:SS]` or `[H:MM:SS]`

### Phase D: Screenshot Capture (MVP)
**Files**: `components/NotesEditor.tsx`, `components/NotesToolbar.tsx`

MVP approach (storyboard thumbnails):
1. Camera button in toolbar
2. On click, get `getCurrentTime()` from VideoPlayerContext
3. Fetch closest YouTube storyboard thumbnail for that time
4. Insert as Image node in TipTap with timestamp caption
5. Store image as URL (not base64) to keep note data small

Production approach (server-side):
1. New API route: `POST /api/screenshot` — accepts `videoId` + `timestamp`
2. Backend uses yt-dlp to download frame at timestamp
3. Returns base64 image or uploads to Supabase Storage
4. Insert into TipTap as Image node

### Phase E: PDF Export
**Files**: `components/NotesEditor.tsx`, new `lib/pdf-export.ts`

1. Install PDF packages
2. Create export function that:
   - Fetches video title via oEmbed
   - Renders TipTap content to styled HTML
   - Converts to PDF with embedded images
   - Downloads as `notes-{video-slug}.pdf`
3. Handle images (screenshots) in PDF — embed as base64
4. Style PDF with clean typography, timestamp markers, image captions

**Packages**: `jspdf`, `html2canvas`

### Phase F: Polish & Edge Cases
1. Handle video not loaded (disable timestamp/screenshot features)
2. Handle failed screenshot capture gracefully
3. Responsive design — notes editor collapses below video on mobile
4. Keyboard shortcuts: Ctrl+B bold, Ctrl+I italic, etc. (TipTap built-in)
5. Placeholder text in empty editor: "Start taking notes... timestamps auto-added on Enter"

---

## Edge Cases & Gotchas

1. **YouTube cross-origin**: Cannot access iframe content directly. Must use postMessage API or YouTube IFrame Player API.
2. **Storyboard availability**: Not all videos have storyboard sprites. Need fallback to static thumbnail.
3. **TipTap JSON migration**: Existing plain-text notes need migration logic when loading.
4. **Large screenshots in notes**: Base64 images bloat Supabase storage. Prefer URLs or Supabase Storage bucket.
5. **PDF with images**: html2canvas may have CORS issues with external image URLs. Pre-fetch as base64 before PDF generation.
6. **Mobile**: Toolbar should be horizontally scrollable. Editor should be full-width below video.
7. **Auto-save with TipTap**: Use `onUpdate` callback with debounce, serialize to JSON.

---

## NPM Packages to Install

```bash
# TipTap editor
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-image @tiptap/extension-placeholder

# PDF export
npm install jspdf html2canvas
```

---

## Implementation Order

1. Phase A → Phase B → Phase C → Phase D → Phase E → Phase F
2. Each phase is independently testable
3. Phase A is the foundation — everything depends on the Video Player API
4. Phase B can be started in parallel with Phase A (editor doesn't need video API)

---

## File Summary

| Action | File |
|--------|------|
| Rewrite | `components/VideoPlayer.tsx` |
| Rewrite | `components/NotesEditor.tsx` |
| Create | `components/NotesToolbar.tsx` |
| Create | `lib/youtube-player.ts` (context + types) |
| Create | `lib/tiptap-timestamp.ts` (custom extension) |
| Create | `lib/pdf-export.ts` |
| Modify | `app/page.tsx` (wrap with VideoPlayerProvider) |
| Maybe | `app/api/screenshot/route.ts` (production screenshot) |
| Maybe | `rag/routes/screenshot.py` (frame extraction) |
