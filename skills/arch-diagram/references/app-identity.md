# Application identity — where /arch-diagram gets the application's name

_Reference for `skills/arch-diagram/SKILL.md` Step 2 · ADO-8001 · AC-F12_

The plugin never contains an application name. The skill reads it from the target repository,
reports where it found it, and derives the diagram title and the file names from it. The
developer can replace it in the draft review.

---

## Resolution order

Stop at the first source that gives a name.

| # | Source | How to read it | Report as |
|---|---|---|---|
| 1 | `.claude/architecture/architecture.md` | The first `# ` heading. Remove the words "Architecture" and "Overview" with any separator next to them (` — `, ` - `, `: `), **before or after** the name: `# Architecture — Contoso Orders` and `# Contoso Orders — Architecture` both give `Contoso Orders`. Skip the file if nothing is left (`# Architecture`) or the heading holds a template placeholder (`[`, `{` or `TEMPLATE`) | `architecture.md title` |
| 2 | `CLAUDE.md` (repository root) | A `Project:` line. Otherwise the first overview section (`## Project Overview`, `## Overview`, `## 1. PROJECT OVERVIEW`) whose first sentence has the form "{Name} is a / is an …": take the words before " is a". A section whose first sentence does not name the project (for example plugin boilerplate) is skipped, and the next overview section is tried. Ignore lines that hold placeholders | `CLAUDE.md project overview` |
| 3 | Manifest, first found | `package.json` → `name` · `*.sln` → file name · `*.csproj` → `<AssemblyName>`, else the file name without `.csproj` · `pyproject.toml` → `[project] name` · `pom.xml` → `<artifactId>` · `go.mod` → last path segment of `module`. **Skip generic names** (`source`, `src`, `app`, `web`, `frontend`, `backend`, `client`, `server`, `api`, `root`, `main`, `monorepo`, `workspace`): for a scoped npm name, use the scope instead (`@contoso.orders/source` → `contoso.orders`); otherwise go to the next manifest | `{file} {field}` (e.g. `package.json name`) |
| 4 | Folder | The repository root folder name | `folder name` |

Read only the root of the repository for steps 2 and 3, not sub-folders (a monorepo's root
manifest names the product; package manifests name its parts).

Print the result before collecting evidence:
```
Application: {name} (from {report as})
```

---

## Derived values

| Value | Rule | Example (`@contoso/orders-web`) |
|---|---|---|
| Name | As found, except a scoped npm name keeps only the part after `/` | `orders-web` |
| Title | `{Name} — Architecture & Recovery` | `orders-web — Architecture & Recovery` |
| Slug | Lower-case; every run of characters other than `a-z` and `0-9` becomes `-`; leading / trailing `-` removed | `orders-web` |
| Spec path | `docs/architecture/diagram/{slug}.arch.yaml` | `docs/architecture/diagram/orders-web.arch.yaml` |
| PNG path | `docs/images/{slug}-architecture.png` | `docs/images/orders-web-architecture.png` |

## Override

In the Step 7 review the developer can reply with a display name, for example "call it
Orders Platform". Then:
- the title becomes `Orders Platform — Architecture & Recovery`
- the slug, and both paths, are derived again from the new name (`orders-platform`)
- nothing else in the spec changes

Report the override in the summary: `Application: Orders Platform (override; found: orders-web from package.json name)`.
