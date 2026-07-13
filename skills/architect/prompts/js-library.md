# Prompts — Custom JS/TS Library

---

## File 1 Prompt — architecture.md

You are a software architect documenting a JavaScript/TypeScript library.
Read in order: package.json, tsconfig.json, the main entry file(s),
and src/ folder structure.

Populate architecture.md completely:

**Technology Stack** — TypeScript version, build tool (Rollup, tsup, esbuild, tsc),
bundle targets (ESM, CJS, UMD, IIFE), test framework, documentation tool.

**Package Metadata** — from package.json: name, version, description,
main/module/exports fields, peerDependencies, engines constraints.

**Folder Structure** — list src/ top-level folders with their purpose.
Identify the public API entry point(s) (index.ts or exports map).

**Public API Surface** — read the main index.ts export.
List every exported function, class, type, interface, and constant with
a one-line description of what it does. Group by category if there are many.

**Internal Module Map** — list the internal modules/folders that the
public API is built from, and their responsibilities.

**Bundle Targets** — document what formats are built, their output files,
and their intended consumers (Node.js, browser, both).

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-api.md

You are documenting the full public API surface of a JS/TS library.
Read every exported symbol from the main entry point and trace into
the implementation files.

For each exported function/method:
- Signature: name, parameters (name, type, required/optional, default),
  return type
- Description: what it does in one or two sentences
- Side effects: any globals mutated, DOM interactions, async behaviour
- Throws: error conditions it raises

For each exported class:
- Constructor signature
- Public methods (signature + description)
- Public properties
- Static members

For each exported type/interface:
- All fields with types and whether required or optional

Group exports into logical categories.

Then document usage patterns:
- Installation and basic setup
- The three most common usage examples with code
- Known gotchas or constraints

Read actual implementation files — do not infer from names alone.

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a JS/TS library.

**npm Package Versions** — all dependencies and devDependencies with exact versions.

**Build Configuration** — read tsup.config, rollup.config, or equivalent.
Document: entry points, output formats, external packages, sourcemap config,
declaration file generation.

**Known Consumers** — if the repo contains example/, demo/, or test/
directories that import the library, list them and note what they demonstrate.

**Publish Configuration** — read package.json: publishConfig, files array,
prepublish/postpublish scripts. Describe the publish process.

**Changelog / Version History** — if CHANGELOG.md exists, summarise
the last 5 versions and what changed.

---

## File 1 addendum — architecture.md diagrams

In addition to the sections above, `architecture.md` MUST contain two Mermaid diagrams:

- **`## End-to-End Architecture`** — a `flowchart LR`: user → app (routes/entry) → HTTP layer →
  backend API → data store, plus any external services. Label edges with protocol/auth where
  known. Only include nodes confirmed from source — never invent one.
- **`## Layered View`** — a `flowchart TB` of the real client layers with dependency direction
  (e.g. components → services → state/store → HTTP), derived from actual imports/module
  boundaries (for a library: public API surface → internals).

Emit valid fenced ` ```mermaid ` blocks; keep node labels short, free of `()[]{}`. If the layer
graph cannot be determined, keep the `> ⚠ Could not determine — needs manual input` marker
instead of an empty or invalid diagram.

---

## File 4 Prompt — architecture-data.md

Document the client data model (for a library: the exported data types). Read state stores/
slices/services, typed models/interfaces, and API client code.

- **Client State Model** — each store/slice/stateful service: state shape (key fields), owning
  feature, persistence (memory/localStorage/none). *(Library: list Exported Data Types instead —
  type/interface, kind, public?, purpose.)*
- **API DTO Shapes** — request/response models exchanged with the backend, from typed
  models/interfaces: DTO, used-by, endpoint, direction.
- **State Ownership & Flow** — which feature owns each piece of state and how it flows
  (inputs/props, selectors, events/actions); derived vs source-of-truth. *(Library: how the
  exported types compose + public-shape versioning constraints.)*
- **Caching / Invalidation** — client-side caching and how it is invalidated.

Every fact from source. Undetectable → `> ⚠ Could not determine — needs manual input`.

---

## File 5 Prompt — architecture-integrations.md

Catalogue external dependencies the app/library calls. Read HTTP client setup, API base-URL
config, third-party SDKs, and any browser/runtime integrations.

- **External Dependencies** — name, kind (REST/GraphQL/SDK/browser API), contract (endpoint),
  where called from, auth (token attachment).
- **Resilience & Failure Behavior** — per-dependency timeout, retry, and UI fallback on failure
  (from code). The **"on failure — what the user sees"** and **SLA/ownership** are usually human
  knowledge — if not in code, write `> ⚠ Could not determine — needs manual input`.
- **Data Exchanged** — what crosses each boundary; flag B1–B7 sensitive data.

Never invent timeouts, SLAs, or owners. Extract only what code shows; flag the rest.

---

## File 6 Prompt — architecture-security.md

Document the trust map and client-side authorization. Read route guards / protected-route
wrappers, auth context/interceptors, token storage, and any role/permission checks in the UI.

- **Trust Boundaries / Zones** — browser → API and any third-party embed; note that the client
  is untrusted and the API is the real enforcement point.
- **Authorization Model** — table of Route/Action → Guard/Role → Enforced-at (name the
  guard/wrapper/interceptor). Note where the UI only *hides* vs actually *enforces* (server does).
- **Business Rules Gating Actions** — role/permission-driven UI gating; flag human-knowledge gaps.
- **Secrets Handling (summary)** — token storage (session vs local), no secrets in the bundle.
- **Sensitive Data Handling** — B1–B7 data rendered/stored client-side and how it is protected.

Do NOT claim the client enforces security the server must — flag "UI-only" gating explicitly.

---

## File 7 Prompt — architecture-decisions.md (SEED ONLY)

Seed the decision log — create the first few `AD-NNN` entries from *detectable, non-obvious*
choices; do not populate the whole file, and **never invent the rationale**.

For each detected choice: **Decision** (from code/config — state-management choice, routing/
auth approach, build tooling, framework/layering), **Rationale** = `> ⚠ Could not determine —
needs manual input`, **Alternatives rejected**, **Date** = `unknown` unless evidenced,
**Status** = `Accepted`.

Seed at most 3–5 entries. **If the file already contains real `AD-NNN` entries with filled
rationale, do not modify it** — it is an append-only human log.
