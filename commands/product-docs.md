---
description: Generate a Product Detail Document and/or User Guide for the current project. Asks which documents you want before creating anything — skips any document you say no to.
argument-hint: (no arguments needed)
---

<skill>product-docs</skill>

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

## Your task

Generate a **Product Detail Document** and/or **User Guide** as self-contained HTML files
written to the project root. **Ask first. Write the files. Output only the confirmation summary.**

---

### Step 1 — Ask which documents to create

Ask the user:

```
I can generate the following documents for this project:

  1. Product Detail Document — stakeholder overview covering problem statement,
     features, architecture, environments, business rules, and success metrics.
     Output: {project-name}-product-overview.html

  2. User Guide — step-by-step end-user instructions with workflows,
     troubleshooting, and FAQ.
     Output: {project-name}-user-guide.html

Which would you like me to create?
  - Both
  - Product Detail Document only
  - User Guide only
  - Neither (cancel)
```

Wait for the user's response. If they say **Neither** or **No** to both, stop here.

---

### Step 2 — Gather project context

Read the following in order (skip silently if absent):

```
!cat README.md 2>/dev/null | head -200 || echo "NO_README"
!cat CLAUDE.md 2>/dev/null | head -100 || echo "NO_CLAUDE_MD"
!cat package.json 2>/dev/null || echo "NO_PACKAGE_JSON"
!find . -name "*.csproj" -not -path "*/node_modules/*" | head -3 | xargs cat 2>/dev/null || echo ""
!ls src/ 2>/dev/null || ls app/ 2>/dev/null || echo ""
```

Extract: project name, version, description, tech stack, key features, architecture summary,
environments, team or owner. If nothing is readable, ask the user for:
- Project name and one-line description
- Primary tech stack (e.g. ASP.NET Core 10, Azure AD, React)
- Key features (up to 5)

---

### Step 3 — Generate each confirmed document

Using the `product-docs` skill:

1. Load `$PLUGIN_DIR/skills/product-docs/references/product-detail-template.html` for the Product Detail Document.
2. Load `$PLUGIN_DIR/skills/product-docs/references/user-guide-template.html` for the User Guide.
3. Replace every `{{PLACEHOLDER}}` with real values derived from Step 2.
4. Remove any `{{#if}}` / `{{#each}}` blocks that have no data.
5. Write each file to the **project root** using Node.js:

```
!node -e "
const fs = require('fs');
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync('REPLACE_WITH_FILENAME', html, 'utf8');
console.log('Written: REPLACE_WITH_FILENAME');
"
```

**Filenames:**
- Product Detail Document → `{project-name}-product-overview.html`
- User Guide → `{project-name}-user-guide.html`

Use kebab-case for the project name (e.g. `ai-assisted-development-product-overview.html`).

---

### Step 4 — Confirm

After writing all confirmed files, output this to the conversation:

```
Documents written:
  ✓ {filename}    ← Product Detail Document
  ✓ {filename}    ← User Guide

Open in any browser to view.
Content derived from: {list sources — README, CLAUDE.md, etc.}

Screenshot placeholders are marked [Screenshot: …] — replace with real
screenshots once available.
```
