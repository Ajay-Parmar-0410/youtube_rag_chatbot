# Phase Check

## When to Use

After completing all tasks in a development phase, run this to verify the phase is truly done before moving to the next one.

## How to Invoke

Invoke via the verification orchestrator at phase milestones. The orchestrator runs ALL sub-agents + E2E suite.

## Phase 1 - MVP Gate

Features: transcript extraction, video player, Q&A, summary (no auth)

| Check | Agent | What to verify |
|-------|-------|---------------|
| Frontend | code-reviewer + tdd-guide | Video player renders, URL input works, summary displays |
| Backend | code-reviewer + tdd-guide | Transcript API returns data, Q&A returns grounded answer |
| Build | build-error-resolver | `npm run build` passes, `tsc --noEmit` clean, `pytest` passes |
| E2E | e2e-runner | Paste URL -> video loads -> ask question -> get answer |

**Pass criteria**: All checks green. No auth or DB checks needed.

## Phase 2 - User Accounts Gate

Features: Supabase Auth, save notes/history, dashboard

| Check | Agent | What to verify |
|-------|-------|---------------|
| Database | code-reviewer | Migrations run, RLS policies enforce user isolation |
| Backend | code-reviewer + tdd-guide | Auth endpoints work (signup, login, logout, refresh) |
| Frontend | code-reviewer + tdd-guide | Login/signup forms work, dashboard renders saved data |
| Security | security-reviewer | No token leaks, auth required on protected routes |
| E2E | e2e-runner | Signup -> login -> save notes -> logout -> login -> notes persist |

**Pass criteria**: All checks green. Phase 1 E2E still passes (no regression).

## Phase 3 - Enhanced Features Gate

Features: flashcards, key topics, transcript viewer, share notes

| Check | Agent | What to verify |
|-------|-------|---------------|
| Backend | code-reviewer + tdd-guide | Flashcard/topics APIs return correct data |
| Frontend | code-reviewer + tdd-guide | All new UI panels render, search works in transcript |
| Security | security-reviewer | Shared links respect read-only, no auth bypass |
| E2E | e2e-runner | Generate flashcards -> view topics -> search transcript -> share link |

**Pass criteria**: All checks green. Phase 1 + 2 E2E still pass.

## Phase 4 - Polish Gate (Final)

Features: multi-language, mobile responsive, performance

| Check | Agent | What to verify |
|-------|-------|---------------|
| E2E | e2e-runner | Full suite across all 5 critical journeys |
| Cross-browser | e2e-runner | Chrome + Firefox pass |
| Mobile | e2e-runner | Mobile viewport tests pass |
| Performance | code-reviewer | Lighthouse score check |
| Security | security-reviewer | Full scan, zero CRITICAL/HIGH issues |
| Coverage | tdd-guide | 80%+ unit + integration across frontend and backend |

**Pass criteria**: ALL previous phase gates still pass + all Phase 4 checks green. Ship it.
