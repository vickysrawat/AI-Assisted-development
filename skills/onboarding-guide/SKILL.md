---
name: onboarding-guide
description: >
  Generate or refresh the project onboarding guide (docs/ONBOARDING.md). Context-aware:
  reads architecture docs, ApprovalRoles.json, and stack detection to produce a project-specific
  guide for both developers joining the project and tech leads governing it.
  Invoked by setup-init (first-time), setup-sync (refresh offer), or ONBOARDING GUIDE command.
---

# Onboarding Guide Skill

_Skill version: 1.0 · Last changed: 2026-09-20 · Plugin compatibility: ≥3.25.0 · Consent: C_

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

> **Consent Category C** — reads architecture docs and plugin state only, never application source.

---

## Step 1 — Check existing guide and parse flags

```bash
ls docs/ONBOARDING.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

Flags:
- `--refresh` → regenerate even if file exists (overwrite)
- No flag → generate if MISSING, skip with message if EXISTS

If EXISTS and no `--refresh`:
```
ℹ docs/ONBOARDING.md already exists — skipping (run ONBOARDING GUIDE --refresh to regenerate).
```
Stop here.

---

## Step 2 — Read project context

Read all available sources. Missing files are gracefully skipped — use `{not yet populated}` placeholder where data is absent.

```bash
# Project identity
cat CLAUDE.md 2>/dev/null | head -30 || echo "NO_CLAUDE_MD"

# Architecture overview
cat .claude/architecture/architecture.md 2>/dev/null | head -80 || echo "NO_ARCH"

# Plugin state
cat .claude/dream-init-state.json 2>/dev/null || echo "{}"

# Governance roles
cat .claude/ApprovalRoles.json 2>/dev/null || echo "{}"

# Business domain (optional)
head -5 .claude/business-context.md 2>/dev/null || echo "NO_DOMAIN"
```

Extract:
- **Project name** — from CLAUDE.md §1 or repo root directory name
- **Stack** — from `dream-init-state.json` → `detected_stacks[]`
- **ADO org/project** — from CLAUDE.md §2 (Organization / Project lines)
- **Tech leads** — from `ApprovalRoles.json` → `tech_leads[]`
- **Security officers** — from `ApprovalRoles.json` → `security_officers[]`
- **Project overview** — first meaningful paragraph from `architecture.md`
- **Plugin version** — from `dream-init-state.json` → `dream_init_plugin_version`

---

## Step 3 — Generate docs/ONBOARDING.md

Write the guide using the extracted context. Use `{placeholder}` for anything not found.
Keep language plain — this is read by developers on day one, not architects.

---

### Document template

```markdown
# {Project Name} — Developer Onboarding Guide

_Generated {YYYY-MM-DD} · Plugin v{version} · Stack: {detected_stacks}_

> Run `ONBOARDING GUIDE --refresh` to regenerate after project changes.

---

## What is this project?

{First 2–3 sentences from architecture.md overview. If absent: "{Project Name} — description not yet captured. Run /architect to generate architecture docs."}

**Stack:** {detected_stacks, comma-separated}
**ADO:** {Organization} / {Project}

---

## The plugin workflow

Every new feature follows this gate sequence:

```
Feature request
      ↓
  ICEA drafted          ← /icea-feature  (Intent · Context · Examples · Acceptance)
      ↓
  ICEA approved         ← APPROVE ADO-{ID}  (Tech Lead reviews)
      ↓
  Implementation        ← IMPLEMENT ADO-{ID}  (code generated, tests included)
      ↓
  Pre-commit check      ← automatic (ICEA gate + secret scan)
      ↓
  Pre-PR checkin        ← /checkin  (code review + security + ICEA compliance)
      ↓
  Pull Request          ← /pr-describe or /pr-create
```

**Why?** The gate catches scope creep, missing acceptance criteria, and security issues
before they reach code review — saving revision cycles downstream.

---

## For Developers — your daily workflow

### Starting a new story

1. Confirm you have the ADO work item ID (e.g. ADO-1847)
2. Start the ICEA: tell Claude what you want to build
   ```
   I need to build [feature description]  — ADO #1847
   ```
3. Claude intercepts, drafts the ICEA document, and saves it to `temp/`
4. Review the ICEA in VS Code preview (`CTRL+SHIFT+V`). Ask for revisions if needed
5. Save: `SAVE ICEA ADO-1847`
6. A Tech Lead must approve before you can implement: `APPROVE ADO-1847`
7. Once approved: `IMPLEMENT ADO-1847`

### Before committing

The pre-commit hook runs automatically. If it blocks:
- **No ICEA found** → your branch name must include `ADO-{ID}` (e.g. `feature/ADO-1847-my-feature`)
- **Secret detected** → remove the credential, use an environment variable instead
- **Hotfix** → use `hotfix/ADO-{ID}-*` branch name; ICEA gate is skipped but logged

### Before raising a PR

Run the checkin gate: `/checkin`

This runs code review, ICEA compliance check, and open findings check in one pass.
It produces a pre-filled commit command if everything passes.

### Commands you'll use most

| Command | What it does |
|---|---|
| `ICEA ADO-{ID}` | Resume drafting an ICEA from a saved plan |
| `IMPLEMENT ADO-{ID}` | Generate implementation code (requires approved ICEA) |
| `STATUS ADO-{ID}` | Check where you are in the process for a story |
| `/checkin` | Pre-PR quality gate |
| `/code-review` | Static code review of your changes |
| `/bug ADO-{ID} — {description}` | Log a bug against a story |
| `/session-start` | Warm up context at the start of a session (recommended) |

---

## For Tech Leads — governance responsibilities

### Approving ICEAs

When a developer sends you an ICEA for review:

1. Open the ICEA file: `docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-{ID}-*.icea.md`
2. Review Intent, Context, Examples, and Acceptance Criteria
3. Approve: `APPROVE ADO-{ID}`

The approval writes `Status: ✅ Approved` to the file and unblocks implementation.
If the ICEA needs changes: `REVISE ADO-{ID}` (or ask the developer to revise with feedback).

### High-risk actions (require Tech Lead role)

The following require your email to be in `ApprovalRoles.json → tech_leads`:

| Action | Why it's gated |
|---|---|
| `APPROVE ALL ADO-{ID}` | Standing approval for multiple file writes — higher blast radius |
| `APPROVE CONFIG` for CI/CD or IaC files | Infrastructure changes need peer review |

### Running the governance report

At sprint end, run: `GOVERNANCE REPORT --sprint {N}`

This produces `governance/governance-report-{date}.md` with:
- ICEA approvals and bypass rates
- RBAC blocks (unauthorised action attempts)
- Finding dismissals and security posture
- Auto-generated sprint lessons

Use it to identify process improvement candidates for `KNOWLEDGE ADD`.

### Configuring roles

Edit `.claude/ApprovalRoles.json` to add or remove team members:
```json
{
  "tech_leads": ["{your email}", "{colleague email}"],
  "security_officers": ["{security team email}"]
}
```

Commit the change — it takes effect in the next session.

### Dismissing security findings

Critical and High findings require a Security Officer's email in `security_officers`.
For Medium and Low, any developer can dismiss via `/dismiss FP-{fingerprint} {reason} "justification"`.

---

## Governance roles on this project

{If ApprovalRoles.json has entries:}

| Role | People |
|---|---|
| Tech Leads | {tech_leads, comma-separated, or "(none configured — edit .claude/ApprovalRoles.json)"} |
| Security Officers | {security_officers, comma-separated, or "(none configured)"} |

{If ApprovalRoles.json is empty:}
> ⚠ No roles configured. All role checks pass silently (opt-out mode).
> To configure: edit `.claude/ApprovalRoles.json` or ask your Tech Lead to do so.

---

## When gates block you

| Block message | Cause | Fix |
|---|---|---|
| `NO ADO ID in branch/commits` | Branch name missing `ADO-{ID}` | Rename branch: `feature/ADO-{ID}-short-description` |
| `NO APPROVED ICEA` | Implementation attempted without approval | `APPROVE ADO-{ID}` (Tech Lead must run this) |
| `TEST PLAN REQUIRED` | No test plan on disk | `SAVE TEST ADO-{ID}` (or `APPROVE ADO-{ID} --skip-test-gate` for spikes) |
| `SECRET DETECTED` | Credential in a config file | Remove it; use env var or `.claude/settings.local.json` instead |
| `ENV FILE COMMITTED` | `.env` file staged for commit | Add to `.gitignore`: `echo ".env" >> .gitignore` |
| `BLOCKED — requires Tech Lead` | Action needs `tech_lead` role | Ask {tech_leads} to run the command in their session |
| `BLOCKED — requires Security Officer` | Dismissing Critical/High finding | Ask {security_officers} to run `/dismiss` |

---

## First story checklist

Before starting your first story:

- [ ] Read this guide
- [ ] Run `/setup-status` — verify all checks are green
- [ ] Run `/session-start` — loads project context
- [ ] Check the architecture docs: `.claude/architecture/architecture.md`
- [ ] Confirm you know your Tech Leads: see "Governance roles" above
- [ ] Try a dry run: ask Claude "what would an ICEA for a small feature look like?" — no files are written

---

## Quick help

- **I'm stuck:** type `STATUS ADO-{ID}` to see exactly what step you're on and what to do next
- **Something broke:** raise an issue at https://github.com/anthropics/claude-code/issues
- **Plugin commands:** type `/` in Claude Code to see all available commands
- **This guide is stale:** run `ONBOARDING GUIDE --refresh`
```

---

## Step 4 — Write the guide

```bash
mkdir -p docs
```

Write the generated document to `docs/ONBOARDING.md`.

Confirm:
```
✅ Onboarding guide generated
   Path: docs/ONBOARDING.md
   Tech Leads: {N configured | none — edit .claude/ApprovalRoles.json}
   Stack: {detected_stacks}

Share docs/ONBOARDING.md with new team members. Run ONBOARDING GUIDE --refresh
after adding team members to ApprovalRoles.json or updating the stack.
```

---

## Hard Rules

- NEVER include source file contents — architecture docs only
- NEVER fabricate role names — use `{not yet configured}` if ApprovalRoles.json is empty
- If architecture.md is absent, use a generic project description with a note to run /architect
- The document must be readable by someone on day one with no prior plugin knowledge
