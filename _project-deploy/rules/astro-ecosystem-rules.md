---
paths: ["**/*.astro", "**/pages/**", "**/layouts/**", "**/components/**"]
detect:
  dependencies: ["astro"]
---

# Astro Ecosystem Rules — Applied to all Astro projects

Covers Astro 4+ with Component Islands, Content Collections, SSR/SSG, and framework integrations.

## TypeScript
- Strict mode in `tsconfig.json` — no implicit `any`
- Frontmatter typed: define a `Props` interface and use `const { ... } = Astro.props`
- Content Collection schemas typed with Zod via `defineCollection` — never untyped collections

## File Naming
- Pages: `kebab-case.astro` in `src/pages/` (e.g. `blog-post.astro`)
- Layouts: `PascalCase.astro` in `src/layouts/`
- Components: `PascalCase.astro` or `PascalCase.{jsx,tsx,vue,svelte}` in `src/components/`
- Content: `src/content/{collection}/slug.md` or `.mdx`

## Component Rules (.astro files)
- Frontmatter (`---`) block for: imports, props destructuring, data fetching, and server logic only
- Template section for HTML output — no JavaScript expressions beyond simple rendering logic
- No `document` or `window` in frontmatter — runs server-side only
- Pass only serialisable values to client-side components via props

## Component Islands
- Default to zero JavaScript — `.astro` components ship no JS to the browser
- Add interactivity only where needed with a framework component (`React`, `Vue`, `Svelte`, `Solid`)
- Choose the right client directive:
  - `client:load` — interactive immediately (above the fold, critical)
  - `client:visible` — lazy-load when entering the viewport (below the fold)
  - `client:idle` — load after the browser is idle (low-priority)
  - `client:media` — load only when a media query matches (responsive interactivity)
- Never use `client:load` for below-the-fold components — prefer `client:visible`

## Content Collections
- Define a Zod schema in `src/content/config.ts` for every collection — never untyped
- Access collections with `getCollection('name')` and `getEntry('name', 'slug')`
- Validate frontmatter fields are typed: `title: z.string()`, `publishedAt: z.coerce.date()`
- Never directly `import` markdown files — use the Content Collection API

## Data Fetching (in Frontmatter)
- Fetch in frontmatter using `await fetch(...)` — runs at build time (SSG) or request time (SSR)
- For SSR, check `Astro.request` for method, cookies, and headers in the frontmatter
- Never fetch in the template section — all async work belongs in frontmatter

## SSR / SSG Configuration
- `output: 'static'` (default) for fully pre-rendered sites
- `output: 'server'` for fully server-rendered pages (requires an adapter)
- `output: 'hybrid'` for mixed: pages opt into SSR with `export const prerender = false`
- Always specify an adapter (`@astrojs/node`, `@astrojs/vercel`, etc.) when using SSR

## Routing
- File-based routing in `src/pages/` — `[param].astro` for dynamic segments
- `getStaticPaths()` required for dynamic routes in static output — return all valid `params`
- API endpoints: `src/pages/api/endpoint.ts` with exported `GET`, `POST`, etc. handlers
- `Astro.redirect('/path', 302)` for redirects — never `window.location`

## Testing
- Vitest for unit tests on utilities and Content Collection helpers
- Playwright for E2E: test full page renders, island interactivity, and form submissions
- Test `getStaticPaths()` output as a plain function call
- Test covers: static render, dynamic routes, island interaction, and ICEA permission boundary

## Accessibility
- All interactive elements (in island components) keyboard-reachable
- ARIA labels on icon-only buttons
- Ensure client-side framework components meet the same accessibility standards

## Out of bounds
- No `document`/`window` in `.astro` frontmatter — server-side only
- No untyped Content Collections — always define a Zod schema
- No `client:load` on below-the-fold components — use `client:visible`
- No direct markdown file imports — use Content Collection API
- No framework components without a `client:*` directive if they require interactivity
