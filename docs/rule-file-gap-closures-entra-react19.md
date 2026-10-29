# Plan — Rule File Gap Closures (Entra + React 19+)

## Context

Tech spec overlays (`techspec-*.md`) are only read during ICEA/tech spec generation. Rule files (`_project-deploy/rules/*.md`) are loaded into LLM context during every file edit and code analysis. Three DO NOT rules from `techspec-react-fastapi.md` have no corresponding entry in always-loaded rule files, so they won't fire during editing:

1. `import React from 'react'` — not in `react-ecosystem-rules.md`
2. `React.FC` — weakly covered ("avoided — prefer"), not a flat prohibition
3. `success: boolean` in POST response DTOs — not in any rule file
4. `loadingRoles` guard when using `isAuthorized` — missing positive pattern in `auth-rules.md`

`python-rules.md` and the Entra DO NOT rules already added to `auth-rules.md` have no gaps.

## Changes — 2 files, 4 targeted edits

### File 1: `_project-deploy/rules/react-ecosystem-rules.md`

**Edit A — Line 14 (TypeScript section):** Strengthen from advisory to flat prohibition.

Before:
```
- React.FC avoided — prefer plain function with explicit return type
```
After:
```
- No React.FC — use a plain function with an explicit return type
```

**Edit B — Line 82 (Out of bounds):** Replace the narrow implicit-children sub-case with a flat ban.

Before:
```
- No React.FC with implicit children — use React.PropsWithChildren<Props> or explicit children: React.ReactNode
```
After:
```
- No React.FC — use a plain function with an explicit return type; if children are needed, declare children: React.ReactNode explicitly
```

**Edit C — Append 2 lines to Out of bounds (after last bullet):**
```
- No `import React from 'react'` — React 19+ uses the automatic JSX transform; importing React is not needed for JSX
- No `success: boolean` in POST response DTOs — return the created resource; the 201 status code carries the success signal
```

### File 2: `_project-deploy/rules/auth-rules.md`

**Edit D — Insert 1 line in Entra section,** after the `idTokenClaims.roles` DO NOT, before the `AUTH_DISABLED` DO NOT:
```
- When `isAuthorized` from `useAuth()` is used in a component, always guard with
  `if (loadingRoles) return <LoadingSpinner />` before the authorization check —
  `isAuthorized` returns `false` during silent token acquisition and causes a
  premature "Access Denied" render without the guard
```

## Verification

- `react-ecosystem-rules.md` Out of bounds: 9 bullets total (was 7); line 14 no longer contains "avoided" or "prefer"
- `auth-rules.md` Entra section: 9 bullets total (was 8); new bullet sits between `idTokenClaims` DO NOT and `AUTH_DISABLED` DO NOT
- `python-rules.md`: no changes needed
