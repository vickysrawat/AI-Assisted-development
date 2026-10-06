# Parity Mapping: React version upgrades

_Loaded when source = `react` for in-place same-stack version upgrades._

> **Scope — same-stack only.** Covers React 17/18 → 19 upgrades (and React 16→17→18 chains).
> Does NOT apply to React → Angular migrations (`react-angular.md`).

---

## Overview

React major upgrades are typically less disruptive than Angular, but React 19 introduced
breaking changes in concurrent rendering defaults, `act()` warnings, and legacy API removal.
Use `react-codemod` for automated migrations.

---

## Pre-hop considerations — before running react-codemod

### react-codemod scope — what it handles vs what it does not

`react-codemod` (and codemod.com's React 19 recipe) handles the **mechanical syntax transforms**
for core React API changes only. It does NOT handle third-party library compatibility.
[VERIFIED — react.dev/blog/2024/04/25/react-19-upgrade-guide, LogRocket]

**react-codemod handles automatically:**
- `ReactDOM.render(<App />, el)` → `ReactDOM.createRoot(el).render(<App />)`
- `ReactDOM.hydrate` → `ReactDOM.hydrateRoot`
- `useFormState` → `useActionState`
- `forwardRef(fn)` → plain `ref` prop on function component
- `React.useContext(X)` → `React.use(X)`
- String refs → callback refs
- Removing unnecessary `import React from 'react'` (React 17+ JSX transform)

**react-codemod does NOT handle:**
- Enzyme tests — require manual migration or switch to React Testing Library
- Legacy Storybook stories targeting old React APIs
- `react-test-renderer` usage
- Third-party component libraries (Material UI, Chakra, Ant Design, etc.)
- `react-router-dom`, `react-hook-form`, `@tanstack/react-query`, `redux`, `recoil`

### Community packages — manual updates required

Third-party React packages have independent release cycles. After upgrading React, manually bump
and test each of these:

```bash
# Check what needs updating
npm outdated
npx check-peer-dependencies   # surface packages whose peer deps don't yet accept React 19

# Common packages requiring explicit upgrade alongside React 19
npm install react-router-dom@latest
npm install @tanstack/react-query@latest
npm install react-hook-form@latest
npm install @mui/material@latest   # or Chakra / Ant Design equivalent
```

### Peer dependency conflicts — npm equivalent of stale version pins

After `npm install react@19 react-dom@19`, third-party packages pinned to older React peer
dependency ranges cause `UNMET PEER DEPENDENCY` warnings. These can cause subtle runtime issues
even when the build succeeds. [VERIFIED — npmjs.com/package/check-peer-dependencies]

```bash
npx check-peer-dependencies   # most comprehensive detection
npm ls react                   # verify all packages resolve to React 19
npm explain <package-name>     # trace a specific version conflict
```

Fix: upgrade the conflicting package to a version that lists React 19 in its peer dependencies.
Do NOT use `--legacy-peer-deps` as a permanent fix.

---

## GREEN — Migrates Cleanly

| Component | Notes |
|---|---|
| JSX syntax | No changes across React 16–19 |
| Function components + hooks | No changes |
| `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` | No changes |
| Context API (`createContext`, `useContext`) | No changes |
| `react-router-dom` routing patterns | Independent versioning; update separately |
| `prop-types` | Not removed in React 19; deprecated usage |
| Error boundaries (`componentDidCatch`) | No changes |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM React 16 → 17

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| JSX transform | React 17 introduced new JSX transform — no more `import React from 'react'` needed per file. Old style still works. | S | LOW |
| Event delegation | Events now delegate to root element instead of `document`. Breaks if code attaches DOM listeners to `document` that intercept React events. | S | HIGH if using `document.addEventListener` |

### Migrating FROM React 17 → 18

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `ReactDOM.render` | Deprecated; replaced with `ReactDOM.createRoot()`. Old API still works with a warning in v18, removed in v19. | S | MEDIUM |
| Automatic batching | React 18 batches all state updates (including in setTimeout, Promises). Previously, only event handlers were batched. May change render count in tests. | S | HIGH — silent behavioral change |
| Concurrent features | `Suspense` / `useTransition` / `useDeferredValue` added. No migration needed; voluntary adoption. | S | LOW |
| Strict Mode double-invocation | `React.StrictMode` in v18 mounts→unmounts→remounts components in dev. `useEffect` runs twice in dev. | S | MEDIUM — dev-only behavioral change |

### Migrating FROM React 18 → 19

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `ReactDOM.render` + `ReactDOM.hydrate` | **Removed** in React 19. Must use `createRoot`/`hydrateRoot`. | M | HIGH — runtime crash |
| `useFormState` → `useActionState` | API renamed in React 19. `useFormState` removed. | S | HIGH — runtime crash |
| `ref` as prop (no `forwardRef`) | React 19 allows `ref` as a direct prop; `forwardRef` deprecated. | S | LOW |
| `defaultProps` on function components | Removed in React 19. Use ES6 default parameters. | S | HIGH — silent: defaults no longer applied |
| String refs | Removed in React 19. Use `useRef()` or callback refs. | S | HIGH — runtime crash |

---

## RED — Will Break

| Component | Version | Impact |
|---|---|---|
| `ReactDOM.render()` | Removed React 19 | App fails to mount |
| `ReactDOM.hydrate()` | Removed React 19 | SSR hydration fails |
| `useFormState` | Removed React 19 (renamed to `useActionState`) | Runtime crash |
| `defaultProps` on function components | Removed React 19 | Defaults silently missing |
| String refs (`ref="myRef"`) | Removed React 19 | Runtime crash |
| Legacy context API (`childContextTypes`, `contextTypes`) | Removed React 19 | Runtime crash |

---

## replacement_mappings

| Old | New | Scope |
|---|---|---|
| `ReactDOM.render(<App />, el)` | `ReactDOM.createRoot(el).render(<App />)` | Entry point (index.js/main.tsx) |
| `ReactDOM.hydrate(<App />, el)` | `ReactDOM.hydrateRoot(el, <App />)` | SSR entry point |
| `useFormState` | `useActionState` | React 19 form components |
| `forwardRef(fn)` | Plain `ref` prop in function component | React 19+ |
| `Component.defaultProps = {...}` | ES6 default parameters `({ prop = default })` | All function components |

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `ReactDOM.render` | React 18 deprecated / React 19 removed | Legacy mount API | Replace with `ReactDOM.createRoot(el).render()` |
| `ReactDOM.hydrate` | React 19 removed | Legacy SSR hydration | Replace with `ReactDOM.hydrateRoot()` |
| `useFormState` | React 19 renamed | Hook renamed to `useActionState` | Replace with `useActionState` |
| `defaultProps` | React 19 removed for function components | Silent: defaults no longer applied | Use ES6 default parameters |
| `childContextTypes` | React 19 removed | Legacy context API | Migrate to `createContext` + `useContext` |
| `contextTypes` | React 19 removed | Legacy context API | Migrate to `createContext` + `useContext` |
| `document.addEventListener` | React 17 event delegation change | May intercept React synthetic events differently | Audit event listeners attached to `document` |
| `setTimeout` | React 18 automatic batching | State updates inside `setTimeout` now batched | Audit test assertions that assume unbatched renders |
| `forwardRef` | React 19 deprecated | Deprecated in favour of `ref` prop | Optional migration; no crash in v19 |

---

## Migration Procedure

### Step 1 — Update React packages
```bash
npm install react@19 react-dom@19
npm install --save-dev @types/react@19 @types/react-dom@19
```

### Step 2 — Run react-codemod
```bash
npx react-codemod update-react-imports  # removes unnecessary `import React`
```

### Step 3 — Replace ReactDOM.render → createRoot
```bash
# Search for usages
grep -r "ReactDOM.render\|ReactDOM.hydrate" src/
# Replace manually in each entry point
```

### Step 4 — Replace deprecated APIs
- `useFormState` → `useActionState`
- `forwardRef` → plain ref prop
- `defaultProps` → ES6 defaults

### Step 5 — Build and test
```bash
# If using TypeScript: type-check FIRST without emitting output
npx tsc --noEmit   # surfaces type errors from updated @types/react before full build

# Then full build and tests
npm run build
npm test
```

> **Build order tip:** `tsc --noEmit` isolates TypeScript type errors (e.g. changed `ref`
> prop types in React 19, removed `defaultProps` types) from bundler and runtime errors.
> Fix type errors first, then run the full build.

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| U1 | React + ReactDOM version | Update packages; fix `createRoot` entry points |
| U2 | Removed API fixes | `defaultProps`, string refs, legacy context |
| U3 | Hook rename | `useFormState` → `useActionState` |
| U4 | Behavioral regressions | Automatic batching; StrictMode double-effect fixes |
| U5 | Dependency updates | react-router, react-query, form libraries |

---

## Post-hop audit checklist

Run after each React major version upgrade before committing:

```
[ ] npx tsc --noEmit (if TypeScript) → fix type errors from updated @types/react first
[ ] npx check-peer-dependencies → detect packages not yet compatible with new React major
[ ] npm ls react → verify all packages resolve to the same React major version
[ ] Run react-codemod for automated transforms (do this ONCE per upgrade, not repeatedly):
      npx react-codemod update-react-imports
      npx codemod react-19  # or check codemod.com registry for the target version
[ ] Manually update community packages NOT handled by codemod:
      [ ] react-router-dom
      [ ] @tanstack/react-query
      [ ] react-hook-form
      [ ] UI library (MUI / Chakra / Ant Design / Radix)
      [ ] redux / recoil / zustand / jotai (state management)
      [ ] Storybook — check React version support; stories may need manual migration
[ ] grep -r "ReactDOM.render\b" src/ → verify zero legacy render calls
[ ] grep -r "defaultProps" src/ → verify zero function component defaultProps (removed React 19)
[ ] grep -r "useFormState" src/ → verify all renamed to useActionState (React 19)
[ ] npm test → run full test suite; pay attention to automatic batching behavioral changes
[ ] Audit document.addEventListener usage — React 17 changed event delegation to root element
```
