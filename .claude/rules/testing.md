---
description: Test coverage targets, tools, and TDD requirements
paths: ["**/*.test.*", "**/*.spec.*", "rag/tests/**", "e2e/**", "playwright.config.*"]
---

# Testing Requirements

## Coverage Targets

| Layer | Tool | Target | What |
|-------|------|--------|------|
| Unit tests | Vitest (frontend), pytest (Python) | 80%+ | Components, utilities, RAG functions |
| Integration tests | Vitest + Supertest, pytest | 80%+ | API routes, RAG chain end-to-end |
| E2E tests | Playwright | Critical flows | 5 core user journeys |
| Security scan | security-reviewer agent | Zero CRITICAL | OWASP Top 10, secrets, auth |
| Type check | `tsc --noEmit` | Zero errors | Full TypeScript coverage |
| Lint | ESLint (TS), Ruff (Python) | Zero errors | Code style consistency |

## TDD Workflow (mandatory)

1. Write test first (RED) -- test must fail
2. Write minimal implementation (GREEN) -- test must pass
3. Refactor (IMPROVE) -- keep tests green
4. Verify coverage >= 80%

## Critical E2E Journeys

1. Paste URL -> video loads -> transcript extracted
2. Ask question -> RAG returns grounded answer
3. Generate summary -> summary displays
4. Create notes -> notes save (with auth)
5. Login -> dashboard shows saved data
