---
paths: ["**/routes/**", "**/app/**", "**/*.tsx"]
detect:
  dependencies: ["@remix-run/react"]
---

# Remix Ecosystem Rules — Applied to all Remix projects

Covers Remix v2+ with file-based routing, loaders, actions, and React patterns.
React rules are self-contained here — `react-ecosystem-rules.md` is NOT deployed alongside.

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks
- Loader/action return types inferred from `typeof loader` — use `useLoaderData<typeof loader>()`
- Form data typed via Zod after parsing — never access `formData.get(...)` without validation

## File-Based Routing (Flat Route Convention)
- Route files in `app/routes/` using dot-separated flat file names: `routes/users.$id.tsx`
- Layout routes: `routes/users.tsx` wraps `routes/users.$id.tsx` via `<Outlet />`
- Index routes: `routes/users._index.tsx` for the `/users` index without the layout file
- Splat routes (`routes/$.tsx`) for catch-all 404 handling

## Loaders (Data Fetching)
- Export a `loader` function for every route that needs server data
- Always return a typed response: `return json<LoaderData>({ ... })`
- Auth checked at the top of every loader — throw `redirect('/login')` if unauthenticated
- Never fetch data client-side for content that can be loaded in a loader

## Actions (Mutations)
- Export an `action` function for every route that handles form submissions or mutations
- Validate all form data with Zod before processing — return `json({ errors }, { status: 400 })` on failure
- Redirect after a successful mutation: `return redirect('/path')` — prevents double-submit on back navigation
- One action per route; use `intent` (hidden form field) to distinguish multiple submit buttons

## Form Handling
- `<Form method="post">` for all mutations — not `fetch` + `useState` for simple cases
- `useFetcher` for background mutations (no navigation) — e.g. like buttons, inline edits
- `useNavigation` to show loading/pending state during form submission
- Never disable the submit button without also showing a loading indicator

## Error Handling
- Export an `ErrorBoundary` in every route that loads or mutates data
- `ErrorBoundary` catches both loader/action errors and unexpected render errors
- `isRouteErrorResponse` to distinguish HTTP errors (404, 403) from unexpected exceptions
- User-facing error messages are sanitized — never expose stack traces

## React Patterns
- Custom hooks prefixed with `use` — exhaustive `useEffect` deps
- `Link` and `NavLink` for internal navigation — never `<a href>`
- `useLoaderData`, `useActionData` for accessing loader/action returns — not global state
- Client-side state with `useState` / Zustand only for UI state not representable in the URL or server

## Testing
- Test loaders and actions as plain async functions — call with a mock `Request` object
- Component tests with Vitest + Testing Library — mock `useLoaderData` for isolated UI tests
- E2E with Playwright — test the full loader → render → action → redirect cycle
- Test covers: happy path, validation error, auth redirect, and ICEA permission boundary

## Accessibility
- All interactive elements keyboard-reachable
- `aria-label` on icon-only buttons
- Focus management: Remix handles focus restoration on navigation by default — do not override without reason
- `aria-live` for dynamic content not caused by navigation

## Out of bounds
- No `useEffect` fetching for data that belongs in a loader
- No `<a href>` for internal links — use `<Link>`
- No unvalidated form data — always parse with Zod in actions
- No mutations outside `action` functions (no direct DB calls in components)
- No missing `ErrorBoundary` on routes that load data
