---
name: product-docs
description: >
  Use when the user asks to generate a Product Detail Document or User Guide for a project.
  Trigger on: "generate product detail", "create product overview", "product document",
  "write user guide", "create user guide", "generate docs", "product documentation",
  "product spec document", "end-user instructions", or any request to produce formal
  documentation for a product or feature. Also triggered by the
  /ai-assisted-development:product-docs command. Always ask which documents the user
  wants before generating — never create a document they said no to.
---

# Product Documentation Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: B_
Generates two document types on demand:

| Document | Purpose | Template |
|---|---|---|
| **Product Detail Document** | Stakeholder-facing HTML overview — problem statement, target users, features, architecture, environments, business rules, NFRs, metrics, future roadmap | `references/product-detail-template.html` |
| **User Guide** | End-user step-by-step HTML instructions — prerequisites, setup, core workflows, tips, troubleshooting, FAQ | `references/user-guide-template.html` |

---


## Model routing

This skill is in the **generation tier** — it uses `ICEA_MODEL` (default: `claude-opus-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "ICEA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.

## Step 1 — Confirm which documents to create

**Always ask before generating.** Present this to the user:

```
I can generate the following documents for this project:

  1. Product Detail Document — stakeholder overview covering problem statement,
     features, architecture, environments, business rules, and success metrics
  2. User Guide — step-by-step end-user instructions with workflows,
     troubleshooting, and FAQ

Which would you like me to create?
  - Both
  - Product Detail Document only
  - User Guide only
  - Neither (cancel)
```

If the user says **No** to a document or chooses **Neither**, do not generate it.
Proceed only with what they confirmed.

---

## Step 2 — Gather project context

Read the following sources (skip silently if absent):

| Source | What to extract |
|---|---|
| `README.md` | Project name, purpose, tech stack, install steps |
| `CLAUDE.md` | Architecture decisions, team conventions, known issues |
| `package.json` / `*.csproj` / `*.sln` | Project name, version, dependencies, target framework |
| `src/` or `app/` top-level structure | Key modules, services, components |
| `.claude-plugin/plugin.json` | Plugin metadata if this is a plugin project |

Build an internal context object:
```
name, version, description, techStack[], keyFeatures[], architectureSummary,
components[], environments[], integrations[], businessRules[], teamOrOwner
```

If critical info is missing (no README and no CLAUDE.md), ask the user for:
- Project name and one-line description
- Primary tech stack
- Key features (up to 5)

---

## Step 3 — Generate each confirmed document

For each document the user confirmed:

1. Read the relevant template from `references/` (load only what is needed).
2. Replace every `{{PLACEHOLDER}}` with real project data derived from Step 2.
3. Remove any `{{#if}}` / `{{#each}}` blocks that have no data — never leave empty sections.
4. Output a **complete, self-contained HTML file** — all CSS is already inline in the
   templates; do not add external CDN links.
5. Write the file to the **project root** (not to `security/` or other subfolders) using
   the naming convention below.

### Output naming

| Document | Filename |
|---|---|
| Product Detail Document | `{project-name}-product-overview.html` |
| User Guide | `{project-name}-user-guide.html` |

Use kebab-case derived from the project name (e.g. `ai-assisted-development-product-overview.html`).

Write each file with Node.js:
```
!node -e "
const fs = require('fs');
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync('REPLACE_WITH_FILENAME', html, 'utf8');
console.log('Written: REPLACE_WITH_FILENAME');
"
```

---

## Step 4 — Quality check before writing

Before writing each file, verify:

- [ ] No unfilled `{{PLACEHOLDER}}` tokens remain
- [ ] No empty `<section>` or structural blocks left behind
- [ ] Screenshot placeholder figures use `<div class="screenshot-placeholder">` from the template
- [ ] All `href` links that reference real URLs are correct; placeholder links are marked `[LINK]`
- [ ] The HTML is complete and well-formed

---

## Step 5 — Confirm

After writing, output to the conversation:

```
Documents written:
  ✓ {filename}              ← Product Detail Document
  ✓ {filename}              ← User Guide

Open either file in any browser to view.
Content was derived from: {list sources used — README, CLAUDE.md, etc.}

Screenshot placeholders are marked with [Screenshot: …] — replace with real
screenshots when available.
```

---

## Reference files

Load these on demand — do not load both upfront if only one document was requested:

| File | When to load |
|---|---|
| `references/product-detail-template.html` | Generating the Product Detail Document |
| `references/user-guide-template.html` | Generating the User Guide |

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`../shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.
