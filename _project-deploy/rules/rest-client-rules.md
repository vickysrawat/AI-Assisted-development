---
paths: ["**/*.ts", "**/*.tsx", "**/services/**", "**/api/**"]
detect:
  dependencies: ["react", "vue", "@angular/core", "svelte", "solid-js", "next", "nuxt", "astro"]
---

# REST Client Rules — Applied to all frontend REST API consumption

Covers how frontend applications call REST APIs. For REST API design and serving
see `rest-api-rules.md`.

## HTTP Client Setup
- One configured HTTP client instance per app — not inline `fetch()` calls scattered across components
- Base URL, auth headers, and default timeout set once in the client config — not per-call
- Interceptors / middleware for: auth token attachment, request ID injection, global error handling
- Typed wrapper functions over raw `fetch` or `axios` — never call the HTTP client directly from components

## Request Patterns
- All API calls in a dedicated service/API layer (`services/userApi.ts`) — not inside components or hooks directly
- Return typed response objects — never return raw `Response` or `AxiosResponse` to the caller
- Use `AbortController` for requests that can be cancelled (search-as-you-type, component unmount):
  ```typescript
  const controller = new AbortController();
  fetch(url, { signal: controller.signal });
  // cleanup: controller.abort()
  ```
- Timeout every request — never rely on the browser's default (which may be infinite)

## Error Handling
- Distinguish error categories:
  - 4xx client errors (validation, auth, not found) → handle in UI (show message, redirect)
  - 5xx server errors → show generic error message, log for monitoring
  - Network errors (offline, timeout) → retry with backoff or show connection error
- Never expose raw API error messages directly to users — map to user-friendly strings
- Log `{ status, url, requestId, duration }` for every failed request — never log request bodies (PII)

## Auth Header Attachment
- Access token attached via interceptor/middleware — never passed as a parameter to service functions
- Token refresh handled transparently in the interceptor — consumers do not handle 401 retry logic
- Never store tokens in `localStorage` for high-security apps — prefer `httpOnly` cookies or in-memory

## Response Typing
- Response shapes typed against an interface derived from the API contract (OpenAPI codegen, manual, or tRPC)
- Validate critical response fields at the boundary — never assume optional fields are present
- `unknown` for unvalidated external data, narrowed via Zod or a type guard before use

## Loading and Optimistic State
- Loading and error state tracked per request — not a single global flag
- Optimistic updates applied immediately; rolled back on error with user notification
- Debounce search/filter calls — never fire a request on every keystroke

## Out of bounds
- No inline `fetch()` calls in components — use the service layer
- No API calls inside `useEffect` without cleanup (cancel the request on unmount)
- No token storage in `localStorage` for sensitive apps
- No raw API error messages shown to users
- No requests without a timeout
