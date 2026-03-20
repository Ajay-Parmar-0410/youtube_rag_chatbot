# PLAN4: UI/UX Overhaul — Agent-Orchestrated, Frontend-Only

> **Goal:** Transform the app from "functional but flat" to polished and modern, without touching any backend integration, API calls, state management, or data flow.
>
> **Constraint:** Every change is CSS/styling/layout/icons only. The deployed app must continue working identically after push — same API calls, same auth flow, same data persistence.
>
> **Execution Model:** Hierarchical multi-agent orchestration. A parent orchestrator delegates to specialized child agents, each scoped to specific component groups. Agents within the same tier can run in parallel when independent.

---

## Table of Contents

1. [Agent Hierarchy](#1-agent-hierarchy)
2. [Execution Flow](#2-execution-flow)
3. [Design System Spec (Shared Context)](#3-design-system-spec--shared-context)
4. [Agent 0 — Frontend Orchestrator](#4-agent-0--frontend-orchestrator)
5. [Agent 1 — Foundation Agent](#5-agent-1--foundation-agent)
6. [Agent 2 — Header Agent](#6-agent-2--header-agent)
7. [Agent 3 — Landing Agent](#7-agent-3--landing-agent)
8. [Agent 4 — Content Agent](#8-agent-4--content-agent)
9. [Agent 5 — Notes Agent](#9-agent-5--notes-agent)
10. [Agent 6 — Viewers Agent](#10-agent-6--viewers-agent)
11. [Agent 7 — Pages Agent](#11-agent-7--pages-agent)
12. [Agent 8 — Polish Agent](#12-agent-8--polish-agent)
13. [DO NOT TOUCH Checklist](#13-do-not-touch-checklist)
14. [Verification Plan](#14-verification-plan)

---

## 1. Agent Hierarchy

```
┌─────────────────────────────────────────────────────┐
│          AGENT 0: Frontend Orchestrator              │
│  Role: Coordinates all child agents, runs build     │
│        checks between tiers, resolves conflicts     │
│                                                     │
│  Step 1: Install dependency (lucide-react)          │
│  Step 2: Launch Agent 1 (Foundation)                │
│  Step 3: Build check ✓                              │
│  Step 4: Launch Agents 2,3 in parallel              │
│  Step 5: Build check ✓                              │
│  Step 6: Launch Agents 4,5,6 in parallel            │
│  Step 7: Build check ✓                              │
│  Step 8: Launch Agent 7                             │
│  Step 9: Build check ✓                              │
│  Step 10: Launch Agent 8 (Polish)                   │
│  Step 11: Final build + full verification           │
└──────────┬──────────────────────────────────────────┘
           │
   ┌───────┴────────────────────────────────────┐
   │            TIER 1 (Sequential)             │
   │                                            │
   │  ┌──────────────────────────────────────┐  │
   │  │  AGENT 1: Foundation Agent           │  │
   │  │  Files: globals.css, layout.tsx      │  │
   │  │  Scope: Color tokens, ambient glow,  │  │
   │  │         utility CSS, theme register  │  │
   │  └──────────────────────────────────────┘  │
   └────────────────────────────────────────────┘
           │
   ┌───────┴────────────────────────────────────┐
   │          TIER 2 (Parallel)                 │
   │                                            │
   │  ┌────────────────┐  ┌──────────────────┐  │
   │  │ AGENT 2:       │  │ AGENT 3:         │  │
   │  │ Header Agent   │  │ Landing Agent    │  │
   │  │                │  │                  │  │
   │  │ AppHeader.tsx  │  │ page.tsx         │  │
   │  │ ThemeToggle    │  │ VideoPlayer.tsx  │  │
   │  │ AuthButton     │  │ EmptyState.tsx   │  │
   │  │                │  │ UrlInput.tsx     │  │
   │  └────────────────┘  └──────────────────┘  │
   └────────────────────────────────────────────┘
           │
   ┌───────┴──────────────────────────────────────────┐
   │            TIER 3 (Parallel)                     │
   │                                                  │
   │  ┌──────────────┐ ┌─────────────┐ ┌───────────┐ │
   │  │ AGENT 4:     │ │ AGENT 5:    │ │ AGENT 6:  │ │
   │  │ Content      │ │ Notes       │ │ Viewers   │ │
   │  │ Agent        │ │ Agent       │ │ Agent     │ │
   │  │              │ │             │ │           │ │
   │  │ ContentPanel │ │ NotesEditor │ │ Transcript│ │
   │  │ ChatMessage  │ │ NotesToolbar│ │ Flashcard │ │
   │  │ LangSelector │ │             │ │ FlashCard │ │
   │  │              │ │             │ │ TopicsList│ │
   │  └──────────────┘ └─────────────┘ └───────────┘ │
   └──────────────────────────────────────────────────┘
           │
   ┌───────┴────────────────────────────────────┐
   │            TIER 4 (Sequential)             │
   │                                            │
   │  ┌──────────────────────────────────────┐  │
   │  │ AGENT 7: Pages Agent                 │  │
   │  │                                      │  │
   │  │ dashboard/page.tsx                   │  │
   │  │ dashboard/loading.tsx                │  │
   │  │ auth/login/page.tsx                  │  │
   │  │ auth/signup/page.tsx                 │  │
   │  │ shared/[shareId]/page.tsx            │  │
   │  │ error.tsx, not-found.tsx, loading    │  │
   │  │ NoteCard.tsx, SessionCard.tsx        │  │
   │  └──────────────────────────────────────┘  │
   └────────────────────────────────────────────┘
           │
   ┌───────┴────────────────────────────────────┐
   │            TIER 5 (Sequential)             │
   │                                            │
   │  ┌──────────────────────────────────────┐  │
   │  │ AGENT 8: Polish Agent                │  │
   │  │                                      │  │
   │  │ Cross-cutting concerns:              │  │
   │  │ - Consistent transitions everywhere  │  │
   │  │ - Stagger animations on lists        │  │
   │  │ - Focus ring consistency             │  │
   │  │ - Final shimmer/skeleton upgrade     │  │
   │  │ - Mobile responsive sweep            │  │
   │  └──────────────────────────────────────┘  │
   └────────────────────────────────────────────┘
```

---

## 2. Execution Flow

```
Step 1:  Orchestrator installs lucide-react
Step 2:  Agent 1 (Foundation)              ← BLOCKING — everything depends on new tokens
Step 3:  Build check
Step 4:  Agent 2 (Header) ║ Agent 3 (Landing)    ← PARALLEL — independent file sets
Step 5:  Build check
Step 6:  Agent 4 (Content) ║ Agent 5 (Notes) ║ Agent 6 (Viewers)  ← PARALLEL
Step 7:  Build check
Step 8:  Agent 7 (Pages)                   ← SEQUENTIAL — uses patterns from Tier 2/3
Step 9:  Build check
Step 10: Agent 8 (Polish)                  ← SEQUENTIAL — cross-cutting final pass
Step 11: Final build + full verification
```

### Why This Order?

| Tier | Agents | Rationale |
|------|--------|-----------|
| 1 | Foundation | Must go first — defines the color tokens, CSS utilities, and ambient glow that ALL other agents consume |
| 2 | Header + Landing | Independent of each other. Header touches `AppHeader/ThemeToggle/AuthButton`. Landing touches `page.tsx/VideoPlayer/EmptyState/UrlInput`. Zero file overlap. |
| 3 | Content + Notes + Viewers | Three completely independent component groups. Content = `ContentPanel + ChatMessage + LanguageSelector`. Notes = `NotesEditor + NotesToolbar`. Viewers = `TranscriptViewer + FlashcardViewer + FlashCard + TopicsList`. Zero file overlap. |
| 4 | Pages | Dashboard/Auth/Error pages — runs after Tier 2-3 so it can reuse proven patterns (card-hover, fade-in, token usage) |
| 5 | Polish | Final sweep across ALL files — adds consistent transitions, staggered animations, focus rings. Must run last because it touches files from every prior agent. |

### Build Check Gates

After each tier completes, the Orchestrator runs:
```bash
npm run build
```
If build fails → the Orchestrator uses `build-error-resolver` agent to fix before proceeding.

---

## 3. Design System Spec (Shared Context)

**Every child agent receives this section as context** so they all use consistent tokens.

### 3.1 New Dependency

```bash
npm install lucide-react
```

### 3.2 Color Tokens — Dark Mode
```css
.dark {
  --background: #09090b;
  --surface: #0f1115;
  --card: #141619;
  --card-elevated: #1a1d21;
  --foreground: #fafafa;
  --muted-foreground: #a1a1aa;
  --muted-foreground-2: #71717a;
  --muted: #1e2024;
  --surface-hover: #1e2024;
  --border: rgba(255, 255, 255, 0.06);
  --card-border: rgba(255, 255, 255, 0.08);
  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --accent-muted: rgba(59, 130, 246, 0.12);
  --input-bg: #141619;
  --input-border: rgba(255, 255, 255, 0.1);
  --input-focus: #3b82f6;
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --glow-1: rgba(59, 130, 246, 0.08);
  --glow-2: rgba(139, 92, 246, 0.06);
}
```

### 3.3 Color Tokens — Light Mode
```css
:root {
  --background: #fafafa;
  --surface: #ffffff;
  --card: #ffffff;
  --card-elevated: #ffffff;
  --foreground: #09090b;
  --muted-foreground: #71717a;
  --muted-foreground-2: #a1a1aa;
  --muted: #f4f4f5;
  --surface-hover: #f4f4f5;
  --border: #e4e4e7;
  --card-border: #e4e4e7;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-muted: rgba(37, 99, 235, 0.08);
  --input-bg: #f4f4f5;
  --input-border: #d4d4d8;
  --input-focus: #2563eb;
  --success: #16a34a;
  --warning: #ca8a04;
  --error: #dc2626;
  --glow-1: rgba(37, 99, 235, 0.04);
  --glow-2: rgba(124, 58, 237, 0.03);
}
```

### 3.4 Icon Mapping

| Feature | Icon | Import |
|---------|------|--------|
| Q&A tab | `MessageCircle` | `lucide-react` |
| Brief summary | `FileText` | `lucide-react` |
| Detailed summary | `BookOpen` | `lucide-react` |
| Transcript | `Captions` | `lucide-react` |
| Flashcards | `Layers` | `lucide-react` |
| Topics | `Lightbulb` | `lucide-react` |
| Notes | `PenLine` | `lucide-react` |
| Save | `Save` | `lucide-react` |
| Export | `FileDown` | `lucide-react` |
| Send message | `Send` | `lucide-react` |
| Dashboard | `LayoutDashboard` | `lucide-react` |
| Login | `LogIn` | `lucide-react` |
| Logout | `LogOut` | `lucide-react` |
| Sun (theme) | `Sun` | `lucide-react` |
| Moon (theme) | `Moon` | `lucide-react` |
| Play (video) | `Play` | `lucide-react` |
| Error | `AlertTriangle` | `lucide-react` |
| Empty | `Inbox` | `lucide-react` |
| Search | `Search` | `lucide-react` |
| Screenshot | `Camera` | `lucide-react` |
| Language | `Globe` | `lucide-react` |
| Share | `Share2` | `lucide-react` |
| Sparkles | `Sparkles` | `lucide-react` |
| Navigate | `ChevronLeft`, `ChevronRight` | `lucide-react` |
| Shuffle | `Shuffle` | `lucide-react` |
| Clock | `Clock` | `lucide-react` |
| Flip hint | `RotateCcw` | `lucide-react` |
| Video | `Video` | `lucide-react` |

### 3.5 CSS Utility Classes (Available After Agent 1)

| Class | Effect |
|-------|--------|
| `fade-in` | 300ms ease-out fade + slide up 8px |
| `skeleton-shimmer` | Smooth gradient shimmer for loading skeletons |
| `btn-press` | scale(0.97) on :active |
| `card-hover` | translateY(-1px) + shadow on hover |
| `stagger-in` | Children animate in with 50ms delay increments |
| `focus-ring` | Consistent 2px accent focus ring on :focus-visible |
| `ambient-glow` | Fixed background gradient orbs |

### 3.6 Shared Rules for ALL Agents

1. **NEVER modify:** API calls, fetch URLs, state hooks, useEffect logic, useCallback dependencies, component prop interfaces
2. **NEVER add:** New API endpoints, new state variables for data, new useEffect for data fetching
3. **OK to add:** Purely presentational state (e.g., hover state for a tooltip, local UI toggle)
4. **OK to add:** Lucide icon imports, CSS classes, aria-labels, title attributes
5. **Replace ALL hardcoded colors:** `zinc-*`, `blue-*`, `gray-*` → design token `var(--*)`
6. **Use transitions:** All interactive elements get `transition-all duration-150` or `duration-200`
7. **Accessibility:** Add `aria-label` to icon-only buttons, keep existing `aria-*` attributes

---

## 4. Agent 0 — Frontend Orchestrator

**Role:** Parent coordinator. Does NOT edit component files directly. Manages execution order, runs build gates, resolves cross-agent conflicts.

**Type:** `general-purpose` agent

### Responsibilities

1. **Pre-flight:** Install `lucide-react`, verify build passes before any changes
2. **Dispatch:** Launch child agents in the correct tier order (Section 2)
3. **Build gates:** Run `npm run build` after each tier. If it fails, spawn `build-error-resolver` agent
4. **Conflict resolution:** If two agents from the same parallel tier accidentally touch the same file, the Orchestrator merges manually
5. **Final verification:** After Agent 8 completes, run full verification checklist (Section 14)

### Orchestrator Pseudocode

```
1. npm install lucide-react
2. npm run build → must pass

3. spawn Agent 1 (Foundation)
4. wait Agent 1
5. npm run build → gate

6. spawn Agent 2 (Header) + Agent 3 (Landing) → PARALLEL
7. wait both
8. npm run build → gate

9. spawn Agent 4 (Content) + Agent 5 (Notes) + Agent 6 (Viewers) → PARALLEL
10. wait all three
11. npm run build → gate

12. spawn Agent 7 (Pages)
13. wait Agent 7
14. npm run build → gate

15. spawn Agent 8 (Polish)
16. wait Agent 8
17. npm run build → final gate

18. run full verification checklist
19. report summary to user
```

---

## 5. Agent 1 — Foundation Agent

**Type:** `general-purpose` agent
**Tier:** 1 (runs first, blocking)
**Files owned:** `app/globals.css`, `app/layout.tsx`
**File count:** 2

### Task

Set up the design system foundation that all other agents depend on.

### Instructions

#### 5.1 globals.css — Replace Color Tokens

Replace the existing `:root` and `.dark` blocks with the new color system from Section 3.2 and 3.3.

Add new tokens to the `@theme inline` block:
- `--color-card-elevated: var(--card-elevated)`
- `--color-accent-muted: var(--accent-muted)`
- `--color-glow-1: var(--glow-1)`
- `--color-glow-2: var(--glow-2)`
- `--color-success: var(--success)`
- `--color-warning: var(--warning)`
- `--color-error: var(--error)`
- `--color-muted-foreground-2: var(--muted-foreground-2)`

#### 5.2 globals.css — Add Ambient Glow CSS

```css
.ambient-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.ambient-glow::before,
.ambient-glow::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
}

.ambient-glow::before {
  top: -20%;
  right: -10%;
  width: 600px;
  height: 600px;
  background: var(--glow-1);
}

.ambient-glow::after {
  bottom: -15%;
  left: -5%;
  width: 500px;
  height: 500px;
  background: var(--glow-2);
}
```

#### 5.3 globals.css — Add Utility Classes

Add all classes from Section 3.5:
- `.fade-in` with `@keyframes fadeIn`
- `.skeleton-shimmer` with `@keyframes shimmer`
- `.btn-press`
- `.card-hover`
- `.stagger-in` (nth-child delays 1-5)
- `.focus-ring`

#### 5.4 layout.tsx — Ambient Glow + z-index

Add `<div className="ambient-glow" aria-hidden="true" />` inside `<body>`, before `<ThemeProvider>`.

Add `className="relative z-10"` to the `<main>` tag.

**DO NOT change:** ThemeProvider, AuthProvider, AppHeader imports, metadata, font config.

### Acceptance Criteria

- [ ] `npm run build` passes
- [ ] Dark mode shows tinted-blue dark backgrounds (not flat grey)
- [ ] Light mode shows clean whites
- [ ] Ambient glow orbs visible in background (subtle, not distracting)
- [ ] All existing components still render (they use the same CSS variable names)

---

## 6. Agent 2 — Header Agent

**Type:** `general-purpose` agent
**Tier:** 2 (parallel with Agent 3)
**Files owned:** `components/AppHeader.tsx`, `components/ThemeToggle.tsx`, `components/AuthButton.tsx`
**File count:** 3

### Task

Upgrade the header from a thin plain strip to a polished, sticky glass-blur navigation bar.

### Instructions

#### 6.1 AppHeader.tsx

- Make header sticky: Add `sticky top-0 z-50`
- Add backdrop blur: `backdrop-blur-md bg-[var(--surface)]/80`
- Increase padding: `py-3 sm:py-4` (was `py-2.5 sm:py-3`)
- Logo: Make icon `h-6 w-6 sm:h-7 sm:w-7` (was `h-5 w-5 sm:h-6 sm:w-6`)
- Logo text: `text-lg sm:text-xl font-bold` (was `text-base sm:text-lg font-semibold`)
- Consider styling "RAG" portion differently (accent color or lighter weight)
- Dashboard link: Import `LayoutDashboard` from lucide-react, add icon (size 16) before "Dashboard" text
- Dashboard link: Increase padding `px-3 py-1.5 sm:px-4 sm:py-2 text-sm` for better touch target

**DO NOT change:** Link hrefs, useAuth hook, conditional rendering logic.

#### 6.2 ThemeToggle.tsx

- Replace inline SVG sun/moon icons with `Sun` and `Moon` from lucide-react (size 18)
- Add `transition-transform duration-200` to the button
- Add `hover:rotate-12` for subtle interaction
- Increase touch target: `p-2 rounded-lg`
- Add `title` attribute: "Switch to light/dark mode"

**DO NOT change:** Theme toggle logic, localStorage, ThemeProvider context.

#### 6.3 AuthButton.tsx

- Import `LogIn`, `LogOut` from lucide-react
- Signed-out state: Filled button `bg-[var(--accent)] text-white` with `LogIn` icon (size 16) + "Sign in" text. Add `btn-press` class.
- Signed-in state: Replace raw email with avatar circle — `h-8 w-8 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center text-sm font-medium` showing first letter of email (uppercase)
- Sign out: Icon-only `LogOut` button (size 16) with `title="Sign out"`, muted styling

**DO NOT change:** signOut function, user prop, Link to auth pages.

### Acceptance Criteria

- [ ] Header is sticky and blurs content behind it when scrolling
- [ ] Theme toggle has lucide icons with rotation animation
- [ ] Auth button shows avatar circle when signed in
- [ ] All navigation links still work
- [ ] Dashboard link visible only when authenticated

---

## 7. Agent 3 — Landing Agent

**Type:** `general-purpose` agent
**Tier:** 2 (parallel with Agent 2)
**Files owned:** `app/page.tsx`, `components/VideoPlayer.tsx`, `components/EmptyState.tsx`, `components/UrlInput.tsx`
**File count:** 4

### Task

Transform the empty/landing state from bare placeholders into a welcoming hero experience.

### Instructions

#### 7.1 page.tsx — Landing Hero

When `!videoId`, instead of showing the standard two-column grid with empty cards, render a centered landing layout:

```
Structure:
- Centered container (max-w-3xl, mx-auto, text-center)
- Hero section:
  - YouTube icon (from AppHeader's SVG, larger ~h-10 w-10)
  - Title: "YouTube RAG" in text-3xl/4xl font-bold
  - Tagline: "Watch. Ask. Learn." in text-xl text-[var(--muted-foreground)]
- UrlInput (full width within the centered container)
- Feature grid (4 columns on desktop, 2 on mobile):
  - Card 1: MessageCircle icon + "Smart Q&A" + "Ask anything about the video"
  - Card 2: FileText icon + "AI Summaries" + "Brief and detailed breakdowns"
  - Card 3: PenLine icon + "Smart Notes" + "Auto-timestamps as you type"
  - Card 4: Layers icon + "Flashcards" + "Study with generated cards"
- Each card: bg-[var(--card)] rounded-xl p-6 ring-1 ring-[var(--card-border)] card-hover
- Cards use fade-in animation with stagger-in on the grid container
```

When `videoId` is set, keep the existing two-column grid layout exactly as-is.

**DO NOT change:** `handleSubmit` callback, `VideoPlayerProvider`, `useSearchParams`, state management, the video-loaded layout structure.

#### 7.2 UrlInput.tsx — Styling Enhancement

- Larger input padding: `px-6 py-3.5` (was `px-5 py-2.5`)
- Larger text: `text-base` (was `text-sm`)
- Subtle shadow on the form container: `shadow-lg shadow-black/5`
- Button: `px-8 py-3.5 text-base font-semibold` + `btn-press` class
- On the landing page, the input should feel prominent and inviting

**DO NOT change:** `handleSubmit`, `validateYouTubeUrl`, error display logic, controlled input state.

#### 7.3 VideoPlayer.tsx — Empty State

Replace the current empty placeholder:
- Import `Play` from lucide-react
- Show a dashed border container: `border-2 border-dashed border-[var(--card-border)] rounded-xl`
- Center a `Play` icon (size 48) inside a circle `h-20 w-20 rounded-full bg-[var(--accent-muted)] flex items-center justify-center`
- Below the icon: "Your video will appear here" in `text-sm text-[var(--muted-foreground)]`

**DO NOT change:** The video-loaded rendering, `PLAYER_CONTAINER_ID`, `VideoPlayerProvider`, any YT API code.

#### 7.4 EmptyState.tsx — General Enhancement

- Icon container: `h-16 w-16` (was `h-14 w-14`), `bg-[var(--accent-muted)]` (was `var(--muted)`)
- Add `fade-in` class to the outer container
- Title: `text-lg` (was `text-base`)
- Description: `max-w-sm` (was `max-w-xs`)
- Action button: Add `btn-press` class

**DO NOT change:** Props interface, action.onClick handler.

### Acceptance Criteria

- [ ] Landing page (no video) shows hero with tagline + feature cards
- [ ] Feature cards animate in with stagger
- [ ] Pasting a URL and clicking Load still works — transitions to video layout
- [ ] Video player empty state shows dashed border with Play icon
- [ ] URL from `?v=` query param still auto-loads video
- [ ] Mobile layout: feature cards 2-column grid

---

## 8. Agent 4 — Content Agent

**Type:** `general-purpose` agent
**Tier:** 3 (parallel with Agents 5, 6)
**Files owned:** `components/ContentPanel.tsx`, `components/ChatMessage.tsx`, `components/LanguageSelector.tsx`
**File count:** 3

### Task

Upgrade the tab bar, chat UI, and content display areas.

### Instructions

#### 8.1 ContentPanel.tsx — Tab Bar

Update the `TABS` array rendering to include icons. Import icons from lucide-react:

```tsx
const TAB_ICONS: Record<TabMode, LucideIcon> = {
  qa: MessageCircle,
  brief: FileText,
  detailed: BookOpen,
  transcript: Captions,
  flashcards: Layers,
  topics: Lightbulb,
};
```

For each tab button:
- Render `<TabIcon size={14} />` before the label text
- Active state: `bg-[var(--accent-muted)] text-[var(--accent)] shadow-sm`
- Inactive state: `text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]`
- All tabs: `transition-all duration-200 px-3.5 py-2 rounded-lg` (changed from rounded-full to rounded-lg for a more modern feel)
- Tab container: Remove the rounded-full muted pill wrapper, use a simpler gap-1 flex with subtle bottom border

Status dots: Add ring glow:
- Loading: `ring-2 ring-yellow-400/30`
- Complete: `ring-2 ring-green-400/20`
- Error: `ring-2 ring-red-400/20`

#### 8.2 ContentPanel.tsx — Q&A Empty State

Replace the simple "Ask a question..." text with:
- `MessageCircle` icon (size 32, muted)
- "Ask anything about this video" heading
- 3 suggested question chips: "What is this video about?", "Summarize the key points", "What are the main takeaways?"
- Each chip: `rounded-full bg-[var(--card-elevated)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all duration-150 cursor-pointer`
- On chip click: `setInput(chipText)` — this is a minor UI convenience, NOT a new API call

#### 8.3 ContentPanel.tsx — Summary Content

- Wrap loaded summary content in a `<div className="fade-in">`
- Replace `animate-pulse` skeletons with `skeleton-shimmer` class
- Add `prose-p:leading-relaxed` to the prose wrapper

#### 8.4 ContentPanel.tsx — Chat Input

- Import `Send` from lucide-react
- Button: Replace "Send" text with `<Send size={18} />` icon + `btn-press` class
- Input: `py-3` (was `py-2`), add subtle shadow to the form container

#### 8.5 ContentPanel.tsx — Loading Indicator

- Keep the bouncing dots but use `bg-[var(--accent)]` instead of `bg-[var(--muted-foreground)]`
- Add left border on the dots container: `border-l-2 border-[var(--accent)]`

#### 8.6 ChatMessage.tsx — Bubble Styling

- User message: `rounded-xl rounded-br-sm shadow-sm` (chat bubble tail shape)
- Assistant message:
  - Background: `bg-[var(--card-elevated)]` (was `bg-[var(--muted)]`)
  - Add left accent border: `border-l-2 border-[var(--accent)]`
  - Shape: `rounded-xl rounded-bl-sm`
- Add `fade-in` class to the outer wrapper

#### 8.7 LanguageSelector.tsx

- Import `Globe` from lucide-react
- Wrap selector in a flex container with `Globe` icon (size 14) before the select element
- Better styling: `rounded-lg` border, token colors

**DO NOT change in ANY of these files:** Any `fetch()` calls, `handleQaSubmit`, `loadSummaryContent`, `handleTabSwitch`, `buildChatHistory`, `persistMessage`, `ensureSession`, prefetch logic, `useEffect` dependencies, session management, `messagesEndRef` scrolling.

### Acceptance Criteria

- [ ] Tabs show icons + text
- [ ] Active tab has accent-muted background
- [ ] Q&A empty state shows suggested question chips
- [ ] Clicking a chip fills the input (does NOT send)
- [ ] Chat messages have shaped bubbles with AI indicator border
- [ ] Summary content fades in on load
- [ ] All API calls still work (Q&A, summaries, transcript)
- [ ] Language selector still works
- [ ] Prefetch dots still show correct status

---

## 9. Agent 5 — Notes Agent

**Type:** `general-purpose` agent
**Tier:** 3 (parallel with Agents 4, 6)
**Files owned:** `components/NotesEditor.tsx`, `components/NotesToolbar.tsx`
**File count:** 2

### Task

Polish the notes editor header, toolbar, and styling.

### Instructions

#### 9.1 NotesEditor.tsx — Header

- Import `PenLine`, `Save`, `FileDown` from lucide-react
- Notes heading: Add `<PenLine size={18} />` before "Notes" text
- Save button: Add `<Save size={14} />` icon before "Save" text, add `btn-press`
- Export .md button: Add `<FileDown size={14} />` icon before ".md", add `btn-press`
- Export .pdf button: Add `<FileDown size={14} />` icon before ".pdf", add `btn-press`
- Better spacing: `gap-2.5` between buttons (was `gap-2`)

#### 9.2 NotesEditor.tsx — Empty State

- Import `PenLine` from lucide-react
- Add icon in a circle: `h-12 w-12 rounded-full bg-[var(--accent-muted)] flex items-center justify-center mb-3`
- "Your notes will appear here" title
- "Load a video and start typing — timestamps are added automatically" description
- Add `fade-in` class

#### 9.3 NotesToolbar.tsx

- Increase button size: `p-2` (ensure all toolbar buttons have consistent padding)
- Active state: `bg-[var(--accent-muted)] text-[var(--accent)]` (was `bg-[var(--accent)] text-white`)
- Add `title` attribute to every button (e.g., "Bold", "Italic", "Heading", "Bullet list", "Task list", "Screenshot")
- Separator between groups: `<div className="w-px h-5 bg-[var(--border)]" />`
- All buttons: `transition-colors duration-150 rounded-lg`
- Screenshot button: Add `Camera` icon from lucide if not already using one

#### 9.4 globals.css — TipTap Placeholder

- Make placeholder text italic: `.ProseMirror p.is-editor-empty:first-child::before { font-style: italic; }`

**DO NOT change:** TipTap editor configuration, extensions, handleKeyDown, onUpdate callback, saveNote, debounce logic, screenshot logic, export functions, migrateToTipTapJson.

### Acceptance Criteria

- [ ] Notes header has icons on heading and buttons
- [ ] Toolbar buttons have tooltips on hover
- [ ] Active toolbar state uses accent-muted (not solid accent)
- [ ] Empty state is inviting with icon and description
- [ ] All editor functionality works: type, timestamp, screenshot, save, export
- [ ] Auto-save still works on 2s debounce

---

## 10. Agent 6 — Viewers Agent

**Type:** `general-purpose` agent
**Tier:** 3 (parallel with Agents 4, 5)
**Files owned:** `components/TranscriptViewer.tsx`, `components/FlashcardViewer.tsx`, `components/FlashCard.tsx`, `components/TopicsList.tsx`
**File count:** 4

### Task

Polish the specialized content viewers — transcript, flashcards, and topics.

### Instructions

#### 10.1 TranscriptViewer.tsx

- Import `Search` from lucide-react
- Search input: Add `Search` icon (size 16) as a positioned element inside/before the input field
- Active segment: `bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30 rounded-lg`
- Timestamp text: `font-mono text-[var(--accent)] text-xs` with subtle `bg-[var(--accent-muted)] px-2 py-0.5 rounded`
- Segment hover: Add `transition-colors duration-150 hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer`
- Search highlight: `bg-yellow-400/20 rounded-sm px-0.5` (softer than solid yellow)
- Add `fade-in` to the transcript container when segments load

#### 10.2 FlashcardViewer.tsx

- Import `Sparkles`, `ChevronLeft`, `ChevronRight`, `Shuffle` from lucide-react
- Generate button: Add `<Sparkles size={16} />` icon, use `btn-press`
- Regenerate button: same icon treatment
- Previous/Next buttons: Use `ChevronLeft`/`ChevronRight` icons (size 20), larger touch targets
- Shuffle button: Add `<Shuffle size={16} />` icon
- Card counter: Replace dots with text "3 of 12" format, centered
- Save button: Add `Save` icon if there's a save button
- Add `fade-in` when flashcards load

#### 10.3 FlashCard.tsx

- Front face: `bg-gradient-to-br from-[var(--card)] to-[var(--card-elevated)]`
- "QUESTION" label: `text-[var(--accent)] text-xs font-semibold uppercase tracking-wider`
- "ANSWER" label: Same accent styling
- Difficulty badge: Use semantic token colors:
  - Easy: `bg-[var(--success)]/15 text-[var(--success)]`
  - Medium: `bg-[var(--warning)]/15 text-[var(--warning)]`
  - Hard: `bg-[var(--error)]/15 text-[var(--error)]`
- "Click to reveal" hint: Add `RotateCcw` icon (size 14) before text
- Card border: `ring-1 ring-[var(--card-border)]`

#### 10.4 TopicsList.tsx

- Import `Lightbulb`, `Clock` from lucide-react
- Generate button: Add `<Lightbulb size={16} />` icon, `btn-press`
- Each topic: Add numbered badge `h-6 w-6 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] text-xs font-bold flex items-center justify-center` showing index+1
- Timestamp buttons: `<Clock size={12} />` icon + timestamp text, pill-styled `bg-[var(--accent-muted)] text-[var(--accent)] rounded-full px-2.5 py-1 text-xs`
- Topic card: `card-hover` class, better padding
- Add `fade-in` and `stagger-in` on the topics list

**DO NOT change:** Any fetch calls, generate/regenerate logic, prefetch data handling, onSeek callbacks, flip animation state, navigation state.

### Acceptance Criteria

- [ ] Transcript has search icon in input and polished segment styling
- [ ] Flashcard buttons have icons and better counter display
- [ ] FlashCard difficulty badges use semantic colors
- [ ] Topics have numbered badges and timestamp pills
- [ ] All viewers still load data from API/prefetch correctly
- [ ] Click-to-seek still works on transcript and topics
- [ ] Flashcard flip still works

---

## 11. Agent 7 — Pages Agent

**Type:** `general-purpose` agent
**Tier:** 4 (sequential, after Tier 3)
**Files owned:** `app/dashboard/page.tsx`, `app/dashboard/loading.tsx`, `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `app/shared/[shareId]/page.tsx`, `app/shared/[shareId]/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`, `components/NoteCard.tsx`, `components/SessionCard.tsx`
**File count:** 11

### Task

Fix color token inconsistencies across all pages, and polish error/loading/404 states.

### Instructions

#### 11.1 NoteCard.tsx — Token Fix

Replace ALL hardcoded Tailwind colors with design tokens:
- `border-zinc-200 dark:border-zinc-700` → `border-[var(--card-border)]`
- `hover:bg-zinc-50 dark:hover:bg-zinc-800` → `hover:bg-[var(--surface-hover)]`
- `text-zinc-900 dark:text-zinc-100` → `text-[var(--foreground)]`
- `text-zinc-600 dark:text-zinc-400` → `text-[var(--muted-foreground)]`
- Any other `zinc-*` → appropriate token
- Add `card-hover` class to the card container
- Add `transition-colors duration-150`
- Import `FileText` from lucide-react, add small icon near the note title

#### 11.2 SessionCard.tsx — Token Fix

Same token replacement as NoteCard.
- Import `MessageCircle` from lucide-react for chat session icon
- Add `card-hover` class
- Replace all `zinc-*` with tokens

#### 11.3 dashboard/page.tsx

- Import `PenLine`, `MessageCircle` from lucide-react
- "Saved Notes" heading: Add `<PenLine size={20} />` icon before text
- "Chat History" heading: Add `<MessageCircle size={20} />` icon before text
- Better grid spacing: `gap-4` (if currently tighter)
- Add subtle divider between sections: `border-t border-[var(--border)] pt-8 mt-8`
- Replace any hardcoded zinc colors with tokens

#### 11.4 auth/login/page.tsx — Token Fix

Replace ALL hardcoded colors:
- `bg-zinc-100 dark:bg-zinc-800` → `bg-[var(--input-bg)]`
- `border-zinc-300 dark:border-zinc-600` → `border-[var(--input-border)]`
- `text-zinc-900 dark:text-zinc-100` → `text-[var(--foreground)]`
- `text-zinc-600 dark:text-zinc-400` → `text-[var(--muted-foreground)]`
- `focus:ring-blue-500` → `focus:ring-[var(--accent)]`
- `bg-blue-600 hover:bg-blue-700` → `bg-[var(--accent)] hover:bg-[var(--accent-hover)]`
- Wrap form in a card: `bg-[var(--card)] rounded-xl p-8 ring-1 ring-[var(--card-border)] shadow-lg`
- Add YouTube RAG logo (SVG + text) at top of form
- Error messages: Add `AlertTriangle` icon
- Add `btn-press` to submit button
- Add `fade-in` to the form container

#### 11.5 auth/signup/page.tsx — Token Fix

Same changes as login page. Ensure visual consistency.

#### 11.6 shared/[shareId]/page.tsx

- Replace any hardcoded zinc colors with tokens
- Style the "Shared Note" badge with `bg-[var(--accent-muted)] text-[var(--accent)]`
- Add `fade-in` to content

#### 11.7 error.tsx

- Import `AlertTriangle` from lucide-react
- Replace inline SVG with `<AlertTriangle size={32} className="text-[var(--error)]" />`
- Card: `bg-[var(--card)] ring-1 ring-[var(--card-border)]`
- "Try again" button: `btn-press` class
- Add `fade-in` to container

#### 11.8 not-found.tsx

- Import `FileQuestion` from lucide-react
- Large "404" text: `text-7xl font-black text-[var(--muted-foreground)]` or gradient text
- Add `FileQuestion` icon below the number
- "Page not found" heading
- "Go home" button: accent styling with `btn-press`
- Add `fade-in`

#### 11.9 loading.tsx

- Spinner: `border-[var(--muted)] border-t-[var(--accent)]` (use tokens)
- Add `fade-in`
- Consider adding "Loading..." in `text-[var(--muted-foreground)]`

#### 11.10 dashboard/loading.tsx

- Replace `animate-pulse` with `skeleton-shimmer` class
- Use token colors instead of any hardcoded greys

#### 11.11 shared/[shareId]/loading.tsx

- Same shimmer + token treatment as dashboard loading

**DO NOT change:** Auth form submit handlers, signIn/signUp calls, Supabase queries, redirect logic, error boundary reset function.

### Acceptance Criteria

- [ ] Zero hardcoded `zinc-*`, `blue-*`, `gray-*` colors remain in any page file
- [ ] Dashboard cards have hover lift effect
- [ ] Auth pages look polished with card container and logo
- [ ] Error/404/Loading pages use lucide icons and design tokens
- [ ] All auth flows still work (login, signup, callback)
- [ ] Dashboard still loads notes and sessions
- [ ] Shared note view still renders correctly

---

## 12. Agent 8 — Polish Agent

**Type:** `general-purpose` agent
**Tier:** 5 (runs last, cross-cutting)
**Files owned:** ALL files previously modified + `globals.css`
**File count:** Cross-cutting

### Task

Final consistency sweep across the entire frontend. This agent reads ALL modified files and ensures:

### Instructions

#### 12.1 Transition Consistency

Scan every component for interactive elements (buttons, links, cards, inputs, tabs) and ensure they ALL have:
- `transition-all duration-150` or `transition-colors duration-150` (buttons, links)
- `transition-all duration-200` (cards, larger elements)

#### 12.2 Animation Consistency

Ensure `fade-in` is applied to:
- All content that loads asynchronously (summaries, flashcards, topics, transcript)
- Empty states
- Error states
- Page-level content on mount

Ensure `stagger-in` is applied to:
- Feature cards on landing page
- Topic list items
- Dashboard card grids

#### 12.3 Focus Ring Consistency

Add `focus-ring` class (or equivalent `focus-visible:ring-2 focus-visible:ring-[var(--accent)]`) to:
- All `<button>` elements
- All `<input>` elements
- All `<select>` elements
- All `<a>` elements that look like buttons

#### 12.4 Skeleton Upgrade

Replace ALL remaining `animate-pulse` usage with `skeleton-shimmer` in:
- ContentPanel summary loading
- Dashboard loading skeletons
- FlashcardViewer loading
- TopicsList loading
- TranscriptViewer loading
- Any dynamic import loading fallbacks in ContentPanel

#### 12.5 Mobile Responsive Check

Review all components for mobile (375px width):
- Feature cards on landing → 2 columns (not 4)
- Tab bar → horizontally scrollable (already is, verify still works)
- Notes editor → full width (not sticky sidebar)
- Buttons → adequate touch targets (min 44px height)
- No horizontal overflow

#### 12.6 Aria Labels

Add `aria-label` to all icon-only buttons that don't have visible text:
- Theme toggle
- Send message (if icon-only)
- Flashcard navigation arrows
- Toolbar buttons in NotesToolbar

### Acceptance Criteria

- [ ] Every interactive element has a transition
- [ ] Every async-loaded content uses fade-in
- [ ] Every button/input/link has a focus-visible ring
- [ ] No animate-pulse remains (all replaced with skeleton-shimmer)
- [ ] Mobile layout works at 375px with no overflow
- [ ] All icon-only buttons have aria-labels
- [ ] `npm run build` passes clean

---

## 13. DO NOT TOUCH Checklist

**Every agent must honor this.** These must remain exactly as-is:

- [ ] **API Routes:** All files in `app/api/` — zero changes
- [ ] **API Calls:** All `fetch()` calls in components (URLs, methods, headers, body)
- [ ] **State Management:** All `useState`, `useCallback`, `useRef`, `useEffect` hooks — logic unchanged
- [ ] **Auth Flow:** `AuthProvider.tsx`, `lib/auth.ts`, `lib/supabase.ts` — zero changes
- [ ] **TipTap Extensions:** Editor configuration, `Timestamp` extension, `handleKeyDown`
- [ ] **Prefetch System:** `lib/prefetch.ts`, prefetch logic in `ContentPanel.tsx`
- [ ] **Data Validation:** `lib/validation.ts`, `lib/rate-limit.ts`
- [ ] **Video Player API:** `VideoPlayerContext`, `YT.Player` initialization, `seekTo`, `getCurrentTime`
- [ ] **Component Props/Interfaces:** Keep all prop types identical
- [ ] **RAG Backend:** Entire `rag/` directory — zero changes
- [ ] **Supabase Schema:** `supabase/` directory — zero changes
- [ ] **Environment Variables:** `.env.local`, `.env.example` — zero changes
- [ ] **Build Config:** `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` — zero changes
- [ ] **YouTube Player:** IFrame API loading, player options, `loadVideoById`
- [ ] **Test Files:** Entire `tests/` directory — zero changes

---

## 14. Verification Plan

### Per-Tier Build Gate
```bash
npm run build
```
Run after each tier. Must pass with zero errors.

### Final Visual Verification

After Agent 8, verify each state:

| # | Check | Page/State |
|---|-------|------------|
| 1 | Landing hero + feature cards | Home, no video |
| 2 | Video loaded + two-column layout | Home, with video |
| 3 | Tab bar with icons | ContentPanel |
| 4 | Q&A empty + suggested chips | Q&A tab, no messages |
| 5 | Q&A with messages | Q&A tab, after asking |
| 6 | Q&A loading indicator | Q&A tab, during answer |
| 7 | Brief summary loaded | Brief tab |
| 8 | Detailed summary loaded | Detailed tab |
| 9 | Transcript with search | Transcript tab |
| 10 | Flashcards with navigation | Flashcards tab |
| 11 | Topics with numbered badges | Topics tab |
| 12 | Notes empty state | Notes panel, no video |
| 13 | Notes with content + toolbar | Notes panel, typing |
| 14 | Dashboard with cards | Dashboard page |
| 15 | Dashboard empty state | Dashboard, no data |
| 16 | Login page | /auth/login |
| 17 | Signup page | /auth/signup |
| 18 | 404 page | /nonexistent |
| 19 | Shared note page | /shared/[id] |
| 20 | Light mode | Toggle theme |
| 21 | Mobile (375px) | Resize browser |

### Functional Regression

| # | Test | Expected |
|---|------|----------|
| 1 | Paste URL → Load | Video plays in player |
| 2 | Ask question | Answer returns from RAG |
| 3 | Generate summary | Brief + Detailed load |
| 4 | Load transcript | Segments with timestamps |
| 5 | Seek via timestamp | Video jumps to time |
| 6 | Generate flashcards | Cards render, flip works |
| 7 | Generate topics | Topics with timestamps |
| 8 | Type in notes | Text + auto-timestamps |
| 9 | Screenshot button | Image inserted in notes |
| 10 | Save notes | Persists to Supabase |
| 11 | Export .md / .pdf | Files download |
| 12 | Login / Signup | Auth works end-to-end |
| 13 | Dashboard loads | Notes + sessions appear |
| 14 | Share note | Public link works |
| 15 | Language selector | Changes Q&A/summary lang |
| 16 | Theme toggle | Light ↔ Dark works |
| 17 | Prefetch dots | Green/yellow/red status |

### Performance

- [ ] `npm run build` — no new warnings from lucide-react (tree-shaking works)
- [ ] No CLS (layout shift) on page load
- [ ] Ambient glow at `position: fixed` — no scroll jank
- [ ] All transitions under 300ms — no sluggish feel

---

## Summary

| Agent | Tier | Files | Parallel With |
|-------|------|-------|---------------|
| 0 — Orchestrator | — | 0 (coordinates only) | — |
| 1 — Foundation | 1 | 2 (`globals.css`, `layout.tsx`) | None (blocking) |
| 2 — Header | 2 | 3 (`AppHeader`, `ThemeToggle`, `AuthButton`) | Agent 3 |
| 3 — Landing | 2 | 4 (`page.tsx`, `VideoPlayer`, `EmptyState`, `UrlInput`) | Agent 2 |
| 4 — Content | 3 | 3 (`ContentPanel`, `ChatMessage`, `LanguageSelector`) | Agents 5, 6 |
| 5 — Notes | 3 | 2 (`NotesEditor`, `NotesToolbar`) | Agents 4, 6 |
| 6 — Viewers | 3 | 4 (`TranscriptViewer`, `FlashcardViewer`, `FlashCard`, `TopicsList`) | Agents 4, 5 |
| 7 — Pages | 4 | 11 (dashboard, auth, shared, error, 404, loading, cards) | None |
| 8 — Polish | 5 | Cross-cutting (all files) | None |
| **Total** | | **~29 files** | **1 new dep** |

Zero API changes. Zero state logic changes. Zero backend changes.
