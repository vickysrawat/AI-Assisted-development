---
description: Generate a complete Azure DevOps task breakdown from an approved ICEA document. Creates one task per Acceptance Criterion per layer (.NET, Angular, Node.js, QA, DB, Infra) with titles, tags, and effort estimates. Run after ICEA approval to populate the sprint board.
argument-hint: ADO-<id>  e.g.  ADO-1847   (or omit — skill will prompt for the ICEA)
---

## Model routing

This command uses the **generation tier** — `ICEA_MODEL`
(default: `claude-opus-4-6`).

To override: `{{ "env": {{ "ICEA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /ado-tasks — ADO task breakdown from approved ICEA

Reads the ICEA document for the given ADO work item and generates a complete,
ready-to-create task list. Every Acceptance Criterion gets a corresponding task
per applicable layer. Run this after the ICEA is approved and before sprint planning.

---

## Step 1 — Locate the ICEA

If an ADO ID was provided:
```bash
ls docs/icea/ADO-{ID}-*.md 2>/dev/null | head -1
```

If not found:
```
⚠ No ICEA file found for ADO-{ID}.
Expected: docs/icea/ADO-{ID}-<feature-name>.md
Run /icea-feature first to create the ICEA, or provide the file path directly.
```
And stop.

If no ADO ID was provided, ask:
```
Which ADO work item should I generate tasks for?
Provide the ID (e.g. ADO-1847) or the full ICEA file path.
```

---

## Step 2 — Run the ado-tasks skill

```
Read skills/ado-tasks/SKILL.md and execute it against the ICEA file identified in Step 1.
```

The skill will:
1. Read the ICEA and extract all Acceptance Criteria
2. Identify the applicable layers from the architecture docs
3. Generate one task per AC per layer
4. Output tasks in ADO-ready format with title, description, tags, and effort estimate
5. Offer to create the tasks directly in ADO via the REST API (requires AZURE_DEVOPS_PAT)

---

## Hard Rules

- NEVER generate tasks for an unapproved ICEA — check for the APPROVED marker first
- NEVER create ADO tasks without displaying them and getting explicit confirmation
- If the ICEA file has `Status: Draft` or no approval marker, stop and ask the developer
  to approve it first via the standard ICEA review flow
