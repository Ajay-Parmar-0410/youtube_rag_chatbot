# Verification Orchestrator

## When to Use

- After every code change (auto-triggered)
- Before commits (`/verify pre-commit`)
- Before PRs (`/verify pre-pr`)
- After completing a development phase (`/verify full`)

## How to Invoke

```
/verify              # Full verification (all sub-agents)
/verify quick        # Build + types only (fast feedback)
/verify pre-commit   # Build + types + lint + security
/verify pre-pr       # Everything + E2E + security scan
```

## Architecture

```
          VERIFICATION ORCHESTRATOR (parent agent)
          Detects what changed → routes to sub-agents → collects verdict
                    |
    ┌───────────────┼───────────────┐
    |               |               |
FRONTEND        BACKEND         DATABASE
VERIFIER        VERIFIER        VERIFIER
    |               |               |
    ├── SECURITY REVIEWER           |
    ├── E2E RUNNER                  |
    └── BUILD FIXER (on failure)    |
```

## Orchestrator Workflow

1. **DETECT** what changed (`git diff`)
2. **ROUTE** to relevant sub-agents (run in parallel):
   - Frontend file changed? -> Frontend Verifier
   - API route / Python changed? -> Backend Verifier
   - Schema / migration / auth changed? -> Database Verifier
   - Any change? -> Security Reviewer
3. **COLLECT** results from all sub-agents
4. **VERDICT**:
   - ALL PASS -> proceed to next task
   - Build error -> dispatch Build Fixer -> re-verify
   - Test failure -> report failing test + context -> fix -> re-verify
   - Security issue -> STOP immediately -> fix before anything else
5. **REPORT** summary to user
6. Phase complete? -> run full E2E suite as final gate

## Sub-Agent Details

### 1. Frontend Verifier
- **Agents used**: `code-reviewer` + `tdd-guide`
- **Trigger**: Any file in `app/`, `components/`, `lib/` changes
- **Checks**:
  - `npm run build` succeeds
  - `tsc --noEmit` passes
  - Unit tests pass (Vitest)
  - No console errors in browser (E2E smoke)
  - Accessibility basics (aria labels, keyboard nav)

### 2. Backend Verifier
- **Agents used**: `code-reviewer` + `tdd-guide`
- **Trigger**: Any file in `app/api/`, `rag/` changes
- **Checks**:
  - API routes return correct status codes and response shapes
  - RAG pipeline returns grounded answers (not hallucinated)
  - Transcript extraction works for various YouTube URLs
  - Error handling: invalid URLs, missing transcripts, rate limits
  - `pytest` passes for `rag/` directory

### 3. Database Verifier
- **Agents used**: `code-reviewer`
- **Trigger**: Any Supabase schema, migration, or auth file changes
- **Checks**:
  - Migrations run cleanly (up and down)
  - Queries return expected data shapes
  - RLS policies enforce user isolation
  - Auth flows: signup, login, token refresh, logout
  - Data persistence: saved notes survive page reload

### 4. Security Reviewer
- **Agent**: `security-reviewer`
- **Trigger**: Any API route, auth, or env-related file changes
- **Checks**:
  - No hardcoded secrets in code or git history
  - All user inputs sanitized (XSS, injection)
  - Auth tokens validated before accessing user data
  - CORS configured correctly
  - Rate limiting active on all public endpoints

### 5. E2E Runner
- **Agent**: `e2e-runner` (Playwright)
- **Trigger**: Phase completion or major feature merge
- **Checks**:
  - 5 critical user journeys pass end-to-end
  - Cross-browser: Chrome + Firefox minimum
  - Screenshots captured on failure, traces for debugging

### 6. Build Fixer
- **Agent**: `build-error-resolver`
- **Role**: Activates only when another verifier reports build/type failure
- **Behavior**: Fix errors incrementally with minimal diffs, re-run verification
- **Guardrail**: Stops if same error persists 3 times (escalates to user)

## Verification Triggers

| Event | What Runs | Mode |
|-------|-----------|------|
| Single file saved | Relevant sub-agent only | Quick |
| Feature branch complete | All sub-agents in parallel | Full |
| Phase milestone reached | All sub-agents + E2E suite | Full + E2E |
| Pre-commit | Build + types + lint + security | Pre-commit |
| Pre-PR | Everything + E2E + security scan | Pre-PR |
