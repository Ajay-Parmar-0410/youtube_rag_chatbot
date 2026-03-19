---
description: API response format, error handling, and input validation patterns
paths: ["app/api/**", "lib/**", "components/**"]
---

# Code Patterns

## API Response Format

All API routes must return this shape:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## Error Handling

- Validate all user inputs (URL format, query length) before processing
- Graceful fallback when transcript is unavailable (show message, not crash)
- Rate limit API routes to stay within free-tier limits
- User-friendly error messages in the UI, detailed logs server-side
- Never silently swallow errors

## Input Validation

- YouTube URL must match `youtube.com/watch?v=` or `youtu.be/` patterns
- Query length capped (prevent token abuse on free-tier LLMs)
- Sanitize all inputs before passing to LLM or database
- Reject malformed requests with 400 + clear error message
