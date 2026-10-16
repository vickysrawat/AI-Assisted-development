---
name: techspec-refresh
description: >
  Audit and refresh tech spec overlay templates. Runs four passes: self-consistency (no web),
  cross-layer contract (LLM + web-confirm framework behaviour), environment fit (env profile),
  and version currency (web search). check: offline audit only. refresh: all four passes + Write Gate.
  Plugin-maintainer tool — operates on plugin overlays, not target-project source.
---

# techspec-refresh Skill

_Skill version: 1.0 · Last changed: 2026-10-16 · Consent: C_

## Purpose

Tech spec overlays (`skills/icea-feature/references/techspec-*.md`) decay in four independent
ways: self-contradictions (code violates the overlay's own rules), cross-layer mismatches
(frontend error handler doesn't match what the backend actually returns), environment
incompatibilities (SQL syntax that fails on the target database), and version staleness
(outdated idioms). This skill runs all four checks and proposes a unified diff under the
Write Gate.

**Why four passes matter:** The two most severe issues found in a prior overlay review —
the FastAPI 422 detail format causing `[object Object]` in Angular/React, and
`RETURNING id` failing on SQL Server — were not version drift. They were cross-layer and
environment failures that web search alone cannot find. All four passes are required.

> **Citation discipline:** Do not trust LLM training knowledge for framework behaviour claims.
> When pass 2 (CC) or pass 4 (version currency) makes a claim about how a framework behaves,
> verify it with a web search and record the source URL. "React 19 uses automatic JSX
> transform" is not a fact until a citation confirms it.

Category C (source-file-consent): reads only the plugin's own overlay files under
`skills/icea-feature/references/`. All writes go through the Write Gate.

## Resolve PLUGIN_DIR

Read `.claude/plugin-path.txt`. If absent, use `skills/shared/plugin-path-resolution.md §1a`.
All paths below use `$PLUGIN_DIR`.

## Model routing

The pattern judge uses `CRITIC_MODEL` (falls back to `REVIEW_MODEL`, default
`claude-sonnet-4-6`). See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

---

## Overlay Registry

All overlay files live under `$PLUGIN_DIR/skills/icea-feature/references/`.

| Overlay name | File | Technologies to version-check |
|---|---|---|
| `angular-nodejs` | `techspec-angular-nodejs.md` | Angular, Node.js, Express, TypeScript |
| `react-nodejs` | `techspec-react-nodejs.md` | React, Node.js, Express, TypeScript, Zod |
| `python-fastapi` | `techspec-python-fastapi.md` | FastAPI, Python, SQLAlchemy, Pydantic, Alembic |
| `aspnet-api-angular` | `techspec-aspnet-api-angular.md` | .NET, Angular, TypeScript |
| `aspnet-mvc-jquery` | `techspec-aspnet-mvc-jquery.md` | .NET Framework, jQuery |
| `vsto` | `techspec-vsto.md` | VSTO, .NET Framework |

---

## Environment Profile

Read from existing project context — never ask the developer to re-specify what the
architect and graph already know. Collect ALL detected databases (a project may use
several simultaneously). Resolve using the following signals in priority order:

### Signal 1 — Package dependencies (highest reliability)

Scan `detection.language[*].generation.packages` and `detection.database[*].generation.packages`
in `dream-init-state.json`. Package names are specific and hard to misclassify.

| Package (NuGet) | Package (npm) | Package (pip) | → Dialect |
|---|---|---|---|
| `Microsoft.Data.SqlClient`, `System.Data.SqlClient` | `mssql`, `tedious` | `pyodbc` + MSSQL DSN | SQL Server |
| `Microsoft.Data.Sqlite`, `System.Data.SQLite` | `better-sqlite3`, `sqlite3` | `aiosqlite` | SQLite |
| `Npgsql` | `pg`, `postgres` | `asyncpg`, `psycopg2` | PostgreSQL |
| `MySql.Data`, `MySqlConnector` | `mysql2` | `aiomysql`, `pymysql` | MySQL |

### Signal 2 — Specific `stack_key` values in `detection.database[]`

Accept only specific dialect keys; ignore generic ones.

| `stack_key` | Usable? | Dialect |
|---|---|---|
| `sql-server` | ✅ Yes | SQL Server |
| `postgresql` | ✅ Yes | PostgreSQL |
| `sqlite` | ✅ Yes | SQLite |
| `mysql` | ✅ Yes | MySQL |
| `sql-relational` | ❌ No — too generic | Unknown |
| `ado-net-legacy` | ⚠ Implies SQL Server, not conclusive | Supplement with Signal 1 |
| `nosql` | ❌ No — skip SQL dialect checks | N/A |

### Signal 3 — Deployed rules

`deployed_rules[]` in `dream-init-state.json`: `sql-server-rules.md` confirms SQL Server;
`postgresql-rules.md` confirms PostgreSQL, etc.

### Signal 4 — Architecture docs / project-knowledge

Scan `.claude/project-knowledge.md` and `docs/` for explicit DB mentions.

### Signal 5 — `--env` override

`--env db=sqlserver` — use only when auto-detection is wrong or ambiguous.

### When detection is incomplete

If after all signals a `sql-relational` or other generic entry remains unresolved:
→ WARN: "Generic database category detected (`{stack_key}`) but specific dialect unknown.
   EF1 checks may be incomplete. Add the DB driver package or set `--env db=...`."

Proceed with the confirmed dialects; do not block on the unresolved generic entry.

---

## Command: `check` (offline, read-only)

Invoked by `CHECK TECHSPEC` or as step 1 of `REFRESH TECHSPEC`.

Runs pass 1 (SC) and pass 3 (LR/UP/stack patterns) without web access.
Runs pass 2 (CC) using LLM reasoning only — does NOT web-confirm framework behaviour.
Runs pass 4 (version currency) as heuristic only — flags ⚠ NEEDS-WEB-CONFIRM, never FAIL.

**Steps:**

1. **Resolve target.** If `ALL`, iterate every registry entry. Otherwise look up the named
   overlay; if not found, list the registry and stop.

2. **Read the overlay.** Parse the file. Extract:
   - Technology version strings from header comments and code blocks.
   - All DO NOT rules (if a `## DO NOT rules` section exists).
   - All conditional section guards.
   - API table rows (method, route, response codes).
   - All code blocks with their section headings.
   - Files Changed table rows.

3. **Run all rubric categories** (web-free):
   - Pass 1 — SC (Self-Consistency): checks SC1–SC5
   - Pass 2 — CC (Cross-Layer Contract): LLM reasoning only, mark results as NOT-WEB-VERIFIED
   - Pass 3 — LR/UP/stack patterns: checks S1–S7, P1–P4, and applicable stack checks (R, A, F)
   - Pass 4 — version currency: flag ⚠ NEEDS-WEB-CONFIRM on version strings that look
     ≥ 2 major releases behind (heuristic, not authoritative)

4. **Render per overlay:**

   ```
   ## techspec-{overlay}.md — check results

   ### Pass 1: Self-Consistency
   | Check | Status | Finding |
   ...

   ### Pass 2: Cross-Layer Contract (LLM-only — not web-verified)
   | Check | Status | Finding |
   ...

   ### Pass 3: LLM-Readability & Patterns
   | Check | Status | Finding |
   ...

   ### Pass 4: Version Currency (heuristic — web-confirm via REFRESH TECHSPEC)
   | Technology | Version found | Flag |
   ...

   Summary: {N} ❌ FAIL · {M} ⚠ WARN · {K} NEEDS-WEB-CONFIRM
   Next: REFRESH TECHSPEC {overlay} [--env db={db}] to apply fixes.
   ```

`check` never writes and never uses WebSearch.

---

## Command: `refresh {overlay}` (all four passes, web-grounded)

Invoked by `REFRESH TECHSPEC {overlay}` or `REFRESH TECHSPEC ALL`.
`ALL`: process overlays one at a time — one Write Gate prompt per overlay.

### Step 1 — Run `check`

Run the offline check first. If the rubric is all ✅ and no version strings look stale, ask:
"No issues found — refresh anyway? (yes / no)." Stop on no.

### Step 2 — WebSearch policy

Read `websearch` from `.claude/dream-init-state.json`.

- **`off` (default):** Prompt: "Allow web search to verify framework behaviour and current
  versions? (A) allow · (B) skip web — pattern audit only."
- **`on`:** Proceed without prompting.
- **B / declined:** Skip web-grounding; use LLM-only reasoning for CC; mark version checks
  as NEEDS-WEB-CONFIRM (not FAIL). Still apply all non-web fixes.

### Step 3 — Pass 2: Cross-Layer Contract (web-grounded)

For each CC check that is WARN or FAIL, confirm the framework's actual behaviour with a
targeted web search. Record source URL and retrieved date for every factual claim.

| CC check | Verification query |
|---|---|
| CC1 — API error shape | `"{framework} validation error response body format" site:docs.{framework-domain}` |
| CC2 — Repository → Service type contract | `"{framework} repository pattern return ORM model" site:docs.{framework-domain}` |
| CC3 — HTTP status reachability | `"{framework} {status_code} exception handler" site:docs.{framework-domain}` |
| CC4 — Auth token transport | `"{framework} JWT bearer token middleware" site:docs.{framework-domain}` |

### Step 4 — Pass 3: Environment Fit (web-grounded if env known)

Use the resolved environment profile. If `db=unspecified`, treat EF failures as WARNs.

| EF check | Verification query |
|---|---|
| EF1 — SQL syntax | `"RETURNING clause {db} support" site:docs.{db}.com OR github.com/{ORM}` |
| EF2 — Runtime-specific API | `"{api} {runtime-version} support" site:nodejs.org OR docs.microsoft.com` |
| EF3 — Hosting-specific pattern | `"{pattern} {host} best practice" site:learn.microsoft.com OR docs.aws.amazon.com` |

### Step 5 — Pass 4: Version Currency (web-grounded)

For each technology in the overlay's registry entry, run ONE focused search:

| Technology | Search query |
|---|---|
| React | `React latest stable release site:github.com/facebook/react` |
| Angular | `Angular latest stable release site:github.com/angular/angular` |
| Node.js | `Node.js current LTS release site:nodejs.org` |
| Express | `Express.js latest npm version site:npmjs.com/package/express` |
| FastAPI | `FastAPI latest release site:github.com/tiangolo/fastapi` |
| Python | `Python latest stable release site:python.org` |
| SQLAlchemy | `SQLAlchemy latest release site:pypi.org/project/SQLAlchemy` |
| Pydantic | `Pydantic v2 latest release site:pypi.org/project/pydantic` |
| Alembic | `Alembic latest release site:pypi.org/project/alembic` |
| TypeScript | `TypeScript latest release site:npmjs.com/package/typescript` |
| Zod | `Zod latest release site:npmjs.com/package/zod` |
| .NET | `.NET latest stable release site:dot.net` |

Record: `{ technology, found_version, source_url, retrieved_date }`. If inconclusive → UNKNOWN.
Never infer a version; only assert what the search result confirms.

### Step 6 — Compose proposed changes

Using all four passes' findings:
- Apply every fix from the [Fixes Catalogue](#fixes-catalogue) for each ❌ FAIL.
- Propose fixes for ⚠ WARN items, marked `[optional]`.
- Update version strings in the header only where web search confirms a newer version
  and the overlay states an explicit version number (not a range like "17+").
- Annotate each version change with its source URL as a comment in the header block.

Present a **unified diff** (changed lines + 3 lines context per hunk).
Group hunks by rubric check ID (e.g. `## Hunk: R1 — Remove import React`).
Never dump the full overlay.

### Step 7 — Judge (CRITIC_MODEL)

Run an inline LLM-as-judge on `CRITIC_MODEL`. PASS / FAIL:

| Check | FAIL when |
|---|---|
| Version accuracy | proposed version not supported by the recorded source URL |
| Behavioural claim | CC check marked as corrected but the web source does not confirm the behaviour |
| Pattern correctness | proposed code would not compile or run correctly |
| Scope | diff edits content unrelated to the identified rubric failures |
| No regression | a change removes a valid current pattern without replacement |

On FAIL: stop, report reasons, present no write prompt.

### Step 8 — Write Gate

On judge PASS:
```
📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
   Path: {$PLUGIN_DIR}/skills/icea-feature/references/techspec-{overlay}.md
```

### Step 9 — On `APPROVE ADO-{ID}`

- Write the updated overlay file.
- Add or update in the header comment block:
  ```
  # Last refreshed: {YYYY-MM-DD}
  # Versions confirmed: {technology list with source URLs}
  ```
- Confirm: "✅ techspec-{overlay}.md refreshed — {N} changes applied."

---

## Rubric — Full Check List

### Pass 1: SC — Self-Consistency (no web needed)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| SC1 | Files Changed ↔ sections | Every Files Changed row has a corresponding implementation section in the overlay | A row exists with no matching section (e.g. migration row but no migration section) |
| SC2 | DO NOT rules ↔ snippets | No code snippet violates a DO NOT rule stated in the same overlay | A snippet does what a DO NOT rule forbids (e.g. DO NOT call commit() in repository, but repository snippet calls commit()) |
| SC3 | API table ↔ code reachability | Every HTTP status in the API table has a code path that produces it | An HTTP status (e.g. 403) appears in the API table but no middleware, exception handler, or raise can produce it |
| SC4 | Header scope ↔ content | Header comment accurately lists covered frameworks; no framework is half-covered | Header lists "FastAPI/Django/Flask" but only FastAPI patterns appear |
| SC5 | Layer contract ↔ return types | Stated layer contract matches actual return type annotations in code blocks | Layer contract says "repository returns ORM models" but repository code returns Pydantic schemas |

### Pass 2: CC — Cross-Layer Contract (LLM reasoning; web-confirm in refresh)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| CC1 | Frontend error handler ↔ API error shape | Frontend handler correctly maps the framework's actual error response body (e.g. FastAPI 422 detail is `list[{loc,msg,type}]`; Express error is `{error, code, details}`) | Handler uses `.message` or `.detail` as a string when the framework returns an array or nested object |
| CC2 | Repository output ↔ service input | Service reads properties consistent with the repository's return type | Service reads `.field` that exists on the Pydantic schema but not on the ORM model the repository returns |
| CC3 | TypeScript types ↔ API response shape | TypeScript interfaces match the fields the backend actually returns | Interface declares `success: boolean` but API returns the created resource; or a field the API returns is missing |
| CC4 | Auth token transport ↔ backend expectation | Frontend attaches the token the same way the backend middleware expects | Frontend sets `X-Auth-Token` but middleware reads `Authorization: Bearer` |

### Pass 3a: LR — LLM-Readability Structure (all overlays)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| S1 | DO NOT rules block | `## DO NOT rules` section appears in the first 40 lines, before any code block | Section absent or after first code block |
| S2 | Layer contract in header | Header has `# Layer contract:` or `# Pattern:` line | Neither present |
| S3 | Conditional section guards | Every conditional section opens with `> **Include only when {X} ∈ all_stacks.** Omit this section ...` | Guard absent, implicit, or partial |
| S4 | Files Changed row guidance | Every Files Changed row describes WHAT changes specifically, not just "Add/modify {Layer}" | Any row has only "Add/modify {Layer}" with no further detail |
| S5 | AC tags in code | Every endpoint/handler/service block has at least one `# AC-F{N}` or `// AC-F{N}` comment | No AC tags in any code block |
| S6 | Tests section present | `## Tests` section with unit-test stub and integration-test stub | Section absent |
| S7 | Error handling section | Section or subsection covers error paths (domain errors, 4xx, detail extraction) | No error handling guidance |

### Pass 3b: UP — Universal Patterns (all overlays)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| P1 | No `success: boolean` response | No DTO/schema has `success: boolean`; 201 responses return the created resource | Present in any response schema |
| P2 | No trailing-slash collection routes | No route string `"/"` on GET-list or POST-create endpoints | `"/"` on any collection route |
| P3 | No f-string / concat SQL | No Python f-string with SQL; no TypeScript template-literal SQL | Either pattern present in code blocks |
| P4 | Tokens not in localStorage | In-memory or HttpOnly cookie stated; no `localStorage.setItem` for auth tokens | localStorage token storage present or not prohibited |

### Pass 3c: React-specific (when overlay covers React)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| R1 | No `import React` | No `import React from 'react'` in component code | Present — React 19+ uses automatic JSX transform |
| R2 | No `React.FC` | No `React.FC` or `React.FunctionComponent` type annotations | Present |
| R3 | `extractDetail()` 422 helper | `extractDetail(detail: unknown): string` helper handles `string \| array` form | Absent in HTTP service section |
| R4 | CSS Modules | Component imports `.module.css`; no inline styles or global class mutations | Not present or not noted |

### Pass 3d: Angular-specific (when overlay covers Angular)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| A1 | No `CommonModule` | `CommonModule` absent from all `imports: []` in component code | Present |
| A2 | `styleUrl` singular | `styleUrl: '...'` in component metadata | `styleUrls: ['...']` (plural) present |
| A3 | `@if` / `@for` control flow | Template guidelines mention `@if` / `@for` (Angular 17+) | Guideline absent |
| A4 | `extractDetail()` 422 helper | Error-detail mapping or `extractDetail` helper present in service section | Absent |

### Pass 3e: FastAPI-specific (when overlay covers FastAPI)

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| F1 | `Annotated[T, Depends()]` | Route handlers use `Annotated[Type, Depends(...)]` syntax | `= Depends(...)` default parameter syntax used |
| F2 | Typed `current_user` | `current_user: Annotated[User, Depends(get_current_user)]` — explicitly typed | Untyped or positional Depends only |
| F3 | No `RETURNING id` in SQL | No raw `RETURNING id` in code blocks | Present |
| F4 | `commit()` in service only | `commit()` in service; repository uses `flush()` only | `commit()` in repository code |
| F5 | Repository returns ORM models | Repository return annotations are ORM model types, not Pydantic schemas | Return type is a Pydantic schema |
| F6 | Domain exceptions | `NotFoundError` / `ForbiddenError` defined and registered in `main.py` | Absent |

### Pass 4: EF — Environment Fit (auto-detected from project context; WARN if unresolved)

#### EF1a — Data access pattern detection

First determine how the overlay accesses data — this governs which EF1b checks apply.

| Pattern detected in overlay | Classification | EF1b applies? |
|---|---|---|
| SQLAlchemy `session.add()` / `session.query()` | ORM | No — ORM is dialect-agnostic |
| Entity Framework `DbSet<T>`, `context.SaveChanges()` | ORM | No |
| Dapper `connection.Query<T>(sql)` / `connection.Execute(sql)` | Micro-ORM (raw SQL) | Yes |
| ADO.NET `SqlCommand` / `DbCommand` / `text()` with SQL string | Raw SQL | Yes |
| ORM + `ExecuteSqlRaw()` / `text()` mixed | Mixed | Yes — check the raw SQL parts only |

#### EF1b — SQL dialect compatibility (Dapper / raw SQL overlays only)

Collect all SQL strings from overlay code blocks. For each string, check compatibility
against every dialect confirmed by the Environment Profile signals. Build a matrix:

| SQL pattern found | SQL Server | PostgreSQL | SQLite | MySQL | Verdict |
|---|---|---|---|---|---|
| `RETURNING id` | ❌ | ✅ | ✅ | ❌ | FAIL if sql-server or mysql in detected set |
| `OUTPUT INSERTED.id` | ✅ | ❌ | ❌ | ❌ | FAIL if any non-SQL-Server in detected set |
| `TOP N` (without `ORDER BY`) | ✅ | ❌ | ❌ | ❌ | FAIL if postgresql, sqlite, or mysql in set |
| `LIMIT N` | ❌ | ✅ | ✅ | ✅ | FAIL if sql-server in detected set |
| `GETDATE()` | ✅ | ❌ | ❌ | ❌ | FAIL if any non-SQL-Server in detected set |
| `NOW()` | ❌ | ✅ | ✅ | ✅ | FAIL if sql-server in detected set |
| `CURRENT_TIMESTAMP` | ✅ | ✅ | ✅ | ✅ | PASS — prefer this |
| `ISNULL()` | ✅ | ❌ | ❌ | ❌ | FAIL if any non-SQL-Server in detected set |
| `COALESCE()` | ✅ | ✅ | ✅ | ✅ | PASS — prefer this |
| Parameterised `@param` / `:param` / `?` | ✅ | ✅ | ✅ | ✅ | PASS |

FAIL = any SQL string is incompatible with any confirmed dialect in the detected set.
ORM overlays: EF1b is skipped; PASS is recorded with note "ORM — no dialect-specific SQL".
Unresolved generic DB (`sql-relational`): WARN, not FAIL — specific dialect unknown.
SQLite only (no other DB confirmed): WARN — likely dev/test only; production dialect unclear.

| ID | Check | PASS when | FAIL when |
|---|---|---|---|
| EF1a | Data access pattern identified | ORM or Dapper/raw SQL confirmed from overlay content | Cannot determine pattern |
| EF1b | SQL dialect compatibility | ORM overlay: always PASS. Dapper/raw SQL: all SQL strings compatible with all confirmed dialects | Any SQL string incompatible with any confirmed dialect |
| EF2 | Runtime-specific APIs | APIs used are available in the runtime from `detection.language[*].generation` | Deprecated or unavailable API for the detected runtime |
| EF3 | Hosting-specific patterns | Cloud-specific patterns match detected hosting from architecture docs | Azure-specific pattern present when AWS hosting detected, or vice versa |

---

## Fixes Catalogue

| Check | Fix |
|---|---|
| SC1 | Add a section for each Files Changed row that has no matching implementation section |
| SC2 | Fix the code snippet so it no longer violates the DO NOT rule |
| SC3 | Add the missing code path (exception handler, middleware, raise) for each unreachable HTTP status |
| SC4 | Remove the unlisted framework from the header, or add complete patterns for it |
| SC5 | Update repository return types and service input types to be consistent |
| CC1 | Add `extractDetail(detail: unknown): string` — handle `string \| {loc,msg,type}[]` for FastAPI; handle `err.response.data` envelope for Express |
| CC2 | Update service code to read ORM model fields, not schema fields |
| CC3 | Update TypeScript interface to match actual API response shape |
| CC4 | Align frontend token header name with backend middleware expectation |
| S1 | Add `## DO NOT rules` before first `---` separator |
| S2 | Add `# Layer contract: {describe flow}` as last line of header comment |
| S3 | Prepend `> **Include only when {X} ∈ all_stacks.** Omit this section ...` to each conditional section |
| S4 | Expand Change column with specific class/decorator/migration/test detail |
| S5 | Add `# AC-F{N}` / `// AC-F{N}` to endpoint, service, and test stub lines |
| S6 | Add `## Tests` section (model: `techspec-python-fastapi.md §Tests`) |
| S7 | Add error handling subsection or expand Reviewer Checklist with error path items |
| P1 | Replace `success: boolean` DTO with `{Feature}Created` resource-shaped type |
| P2 | Replace `"/"` with `""` on collection routes |
| P3 | Add to DO NOT block: no f-string SQL; no template-literal SQL |
| P4 | Add note or DO NOT rule: in-memory or HttpOnly cookie only — never localStorage |
| R1 | Remove `import React from 'react'` from component code blocks |
| R2 | Replace `React.FC` with plain named function: `export function {Feature}(): JSX.Element` |
| R3 | Add `extractDetail` helper to HTTP service section |
| R4 | Add CSS Modules note to component guidelines |
| A1 | Remove `CommonModule` from component `imports` array |
| A2 | Change `styleUrls: ['./{feature}.component.scss']` → `styleUrl: './{feature}.component.scss'` |
| A3 | Add `@if` / `@for` template guideline; note no NgIf directive needed |
| A4 | Add `extractDetail` to Angular service `catchError` block |
| F1 | Update route handler signatures to `Annotated[Type, Depends(...)]` |
| F2 | Add `User` type: `current_user: Annotated[User, Depends(get_current_user)]` |
| F3 | Replace raw INSERT with `session.add(obj); await session.flush()` |
| F4 | Move `await self._db.commit()` from repository to service |
| F5 | Update repository return type annotations to ORM model classes |
| F6 | Add `app/exceptions.py` with `NotFoundError`/`ForbiddenError`; register handlers in `main.py` |
| EF1a | Data access pattern not identifiable — clarify in overlay header whether ORM or Dapper/raw SQL is used |
| EF1b | For each incompatible SQL string: replace with ANSI-standard equivalent (`COALESCE` not `ISNULL`, `CURRENT_TIMESTAMP` not `GETDATE`, ORM flush not `RETURNING id`); or add explicit dialect-conditional snippets labelled by DB |
| EF2 | Update API usage or add version guard note |
| EF3 | Add hosting-specific note or conditional section |

---

## Eval Set

Known-issue test cases live at:
`$PLUGIN_DIR/skills/techspec-refresh/evals/techspec-react-nodejs-eval.json`

Seeded from the human review of `techspec-react-nodejs.md` on 2026-10-16.
A working `CHECK TECHSPEC react-nodejs` run should surface all cases marked `expected: FAIL`.
Cases marked `expected: PASS` verify the skill does not over-trigger.

To run: `CHECK TECHSPEC react-nodejs` and compare output against the eval file.

---

## Hard Rules

- NEVER write an overlay without `APPROVE ADO-{ID}`.
- NEVER assert a version string or framework behaviour claim without a web-sourced URL (when web search ran).
- NEVER change sections unrelated to identified rubric failures — diff scope = issues found only.
- NEVER run `check` with network I/O — `check` is strictly read-only, no WebSearch.
- `REFRESH TECHSPEC ALL`: one Write Gate prompt per overlay — no batch APPROVE across files.
- If the judge FAILs on correctness or scope, stop and report — do not retry automatically.
- If a CC claim cannot be web-verified (inconclusive search), mark it NEEDS-MANUAL-REVIEW,
  not PASS. Do not promote an unverified claim to VERIFIED.
