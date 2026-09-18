# ADR 0067 — Web Search query sanitization policy

Date: 2026-09-18 · Status: Accepted

## Context

Claude Code's WebSearch and WebFetch tools send a query string to an external search
provider. If Claude constructs that query directly from the user's conversation — which may
contain class names, method names, file paths, or organization-specific identifiers — those
strings leave the local environment without the developer explicitly choosing to disclose
them.

Two controls already exist at the platform level:

1. **Tool permission prompt** — Claude Code shows each proposed tool call and its arguments
   before execution; the developer can deny it.
2. **Offline knowledge tier** (`skills/shared/migration-knowledge/refs/`) — pre-loaded
   framework and library references that avoid a network call entirely.

The offline tier cannot substitute for live web search: library APIs, framework releases, and
security advisories change continuously and cached refs go stale. Web search remains
necessary.

## Decision

A `## Web Search Policy` section is added to `_project-deploy/CLAUDE.md` (deployed to every
target project by `setup-init`) that mandates query sanitization before any WebSearch or
WebFetch call:

> Before calling WebSearch or WebFetch, sanitize the query:
> - Remove all internal identifiers: class names, method names, file paths,
>   variable names, and any project- or organization-specific terms.
> - Replace them with generic technology descriptors.
> - The query must contain only publicly recognizable technology terms.

### What the query MAY contain (sent externally)

- Language name (e.g. `C#`, `TypeScript`, `Python`)
- Framework or library name and version (e.g. `Angular 18`, `.NET 8`, `Express 4`)
- Error type or category (e.g. `null reference exception`, `CORS`, `JWT validation`)
- Publicly recognizable API or pattern names (e.g. `lazy loading`, `dependency injection`)

### What the query MUST NOT contain (never sent externally)

- Internal class, method, or variable names
- File paths or folder names from the repository
- Organization, client, or project names
- Database schema names, table names, or column names
- Any string that would only appear in private source code

The existing tool permission prompt (control 1) remains the final safety net: the developer
reviews the sanitized query before approving the tool call.

## Consequences

- Claude self-sanitizes before proposing a WebSearch/WebFetch call; developers reviewing the
  permission prompt see generic queries rather than internal identifiers.
- Web search remains available for current library/framework information — offline staleness
  is not traded for privacy.
- The policy propagates to all target projects automatically via `setup-init` with no per-project
  configuration needed.
- Enforcement is prompt-level (instruction to the model) not mechanical; the tool permission
  prompt is the hard backstop.

## Alternatives rejected

- **Disable WebSearch entirely** — removes access to current library documentation and
  security advisories; offline refs are not a substitute for live information.
- **Rely on offline knowledge tier only** — refs go stale; acceptable for stable APIs but not
  for rapidly evolving frameworks or CVEs.
- **Per-project configuration** — adds setup friction with no benefit; the sanitization
  requirement is universal.
