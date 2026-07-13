---
paths: ["**/app/**", "**/pages/**", "**/*.tsx", "**/components/**"]
detect:
  dependencies: ["next"]
---

# Next.js Ecosystem Rules — Applied to all Next.js projects

Covers Next.js App Router, React patterns, data fetching, and E2E testing with Playwright.
For React rules not specific to Next.js see the React sections below — they are
self-contained here; `react-ecosystem-rules.md` is NOT deployed alongside this file.

## TypeScript
- Strict mode enabled — no implicit `any`, strict null checks
- Props typed with an explicit `interface`; page props from `PageProps` / `LayoutProps` generics
- `next.config.ts` — prefer `.ts` over `.js` for type-checked config

## App Router (default — prefer over Pages Router)
- Route segments in `app/` using file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- `generateMetadata` for dynamic page metadata — never set `<title>` tags manually in page components
- `generateStaticParams` for statically generating dynamic routes at build time

## Server vs Client Components
- Default to Server Components — add `'use client'` only when the component needs: browser APIs, event listeners, hooks (`useState`, `useEffect`), or interactive state
- Never use `useState` / `useEffect` in a Server Component — move those to a Client Component leaf
- Pass serialisable props only from Server to Client Components — no functions, class instances, or non-serialisable objects
- Mark utility modules `server-only` when they must never reach the browser (DB access, secrets)

## Data Fetching
- Fetch in Server Components using `fetch()` with explicit `cache` / `revalidate` options
- Use `React.cache()` to deduplicate expensive calls within a single render tree
- Server Actions for mutations: `'use server'` directive, validate input with Zod before processing, always redirect after success
- Never use `useEffect` to fetch server data — use Server Components or TanStack Query for client-cached data

## React Patterns (Next.js aware)
- Custom hooks prefixed with `use` — exhaustive deps in `useEffect`
- `useRouter`, `usePathname`, `useSearchParams` only in Client Components
- `Link` component for all internal navigation — never `<a href>`
- `Image` from `next/image` for all images — never raw `<img>` (performance, LCP)
- `Font` from `next/font` for web fonts — never `@import` in CSS (FOIT prevention)

## State Management (client-side)
- TanStack Query for client-cached server state when SSR is insufficient
- Zustand for shared UI state across Client Components
- Avoid Redux in Next.js App Router — server data belongs in Server Components, not a global store

## Routing & Navigation
- `redirect()` from `next/navigation` in Server Components and Server Actions — not `router.push`
- `notFound()` from `next/navigation` to render the nearest `not-found.tsx`
- Dynamic segments typed via `Promise<{ params: { id: string } }>` in Next.js 15+

## Security
- Environment variables prefixed `NEXT_PUBLIC_` only for values safe to expose to the browser
- Never import server-side modules (DB, secrets) in Client Components — use Server Actions or API routes
- Content Security Policy headers in `next.config.ts` → `headers()`

## Testing
- Vitest + Testing Library for unit/component tests
- Playwright for E2E: role-based selectors, Page Object Model per feature area, CI headless mode
- Test Server Actions and loaders as plain async functions — no need to mount the full page

## Accessibility
- All interactive elements keyboard-reachable
- `aria-label` on icon-only buttons
- Focus management on modal open/close
- `aria-live` for dynamic content updates

## Out of bounds
- No `<a href>` for internal links — use `<Link>`
- No raw `<img>` — use `<Image>` from `next/image`
- No `useEffect` for data fetching — use Server Components or TanStack Query
- No `NEXT_PUBLIC_` prefix on secrets
- No Pages Router patterns (`getServerSideProps`, `getStaticProps`) in App Router projects
