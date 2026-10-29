---
name: rule-check
description: >
  Scans recently changed files against all deployed DO NOT rules in .claude/rules/.
  Run on demand or after IMPLEMENT to catch rule violations before code review.
  Invoked by CHECK RULES (working-tree changes) or CHECK RULES ADO-{ID} (branch changes).
---

# rule-check Skill

_Skill version: 1.0 · Last changed: 2026-10-27 · Plugin compatibility: ≥3.26.0 · Consent: C_

Performs an LLM-based scan of changed files against deployed DO NOT rules.
Read-only — never modifies any file.

---

## Persona

Acts with a **[DR] Design Reviewer** lens — read the intent of each DO NOT rule and
look for violations in the changed code. Lens only; never attribute, never assume.
See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use
> the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

---

## Step 1 — Determine target files

Parse the invocation:
- `CHECK RULES` (no ADO) → working-tree changes (`git diff HEAD` + `git diff --cached`)
- `CHECK RULES ADO-{ID}` → branch changes (`git diff origin/{target-branch}...HEAD`)

```bash
# Working-tree mode:
git diff HEAD --name-only 2>/dev/null
git diff --cached --name-only 2>/dev/null

# Branch mode — read target branch from CLAUDE.md "Target branch:" line:
TARGET_BRANCH=$(grep -m1 "Target branch" CLAUDE.md 2>/dev/null | sed 's/.*: *//')
git diff "origin/${TARGET_BRANCH:-dev}...HEAD" --name-only 2>/dev/null
```

De-duplicate the list and exclude generated / non-source files:
- `*.json`, `*.lock`, `*.map`, `*.min.*`, `*/migrations/*`, `alembic/versions/*`

If no changed files remain: output `✅ No changed source files to scan.` and stop.

---

## Step 2 — Collect deployed DO NOT rules

```bash
node -e "
const fs = require('fs');
let man;
try { man = JSON.parse(fs.readFileSync('.claude/rules/_deploy-manifest.json', 'utf8')); } catch(e) {
  console.log('NO_MANIFEST'); process.exit(0);
}
const rules = {};
for (const file of (man.deployed_rules || [])) {
  try {
    const content = fs.readFileSync('.claude/rules/' + file, 'utf8');
    const doNots = content.split('\n')
      .filter(l => l.trim().startsWith('- DO NOT') || l.trim().startsWith('- No ') || l.trim().startsWith('- Never '))
      .map(l => l.trim());
    if (doNots.length) rules[file] = doNots;
  } catch(e) {}
}
console.log(JSON.stringify(rules, null, 2));
" 2>/dev/null
```

- `NO_MANIFEST` → output `⚠ No deploy manifest — run /setup-init first.` and stop.
- Empty result → output `ℹ No DO NOT rules in deployed rule files.` and stop.

Also read each rule file's `paths:` frontmatter to build a map of which file patterns each
rule set applies to:

```bash
node -e "
const fs = require('fs');
let man;
try { man = JSON.parse(fs.readFileSync('.claude/rules/_deploy-manifest.json', 'utf8')); } catch(e) { process.exit(0); }
for (const file of (man.deployed_rules || [])) {
  try {
    const content = fs.readFileSync('.claude/rules/' + file, 'utf8');
    const m = content.match(/^---[\s\S]*?paths:\s*(\[.*?\])[\s\S]*?---/m);
    const paths = m ? m[1] : '[]';
    console.log(file + '\t' + paths);
  } catch(e) {}
}
" 2>/dev/null
```

A rule file with no `paths:` frontmatter (or `paths: []`) applies to all files.

---

## Step 3 — Scan each changed file

For each changed file from Step 1 that exists on disk:

1. Read the file content.
2. From the paths map in Step 2, identify which rule files apply to this file. Apply a rule
   file if: it has no `paths:` filter, OR at least one glob in its `paths:` array matches the
   file path (use simple glob matching: `**/*.tsx` matches any `.tsx`, `**/auth/**` matches any
   path containing `auth/`).
3. Ignore rules whose language clearly doesn't match the file's extension (e.g. Python-specific
   rules against `.tsx` files). When uncertain, include the rule file.
4. For each applicable rule file, scan the file content against its DO NOT rules.

**Evaluation approach:**
- Read the file content in full.
- For each DO NOT rule: does the code actively do what the rule forbids?
- A violation requires positive evidence — the forbidden pattern must be present, not merely
  the absence of the correct alternative.
- Be precise: a rule about `React.FC` only fires if `React.FC` is literally used.
- When uncertain, do not report — false positives erode trust in the check.

Output per file:
```
### {filename}
  Applied rules: {rule-file-1}, {rule-file-2}
  ✅ No violations found.
```
or:
```
### {filename}
  Applied rules: {rule-file-1}, {rule-file-2}
  ❌ [{rule-file}] {DO NOT rule text (first 100 chars)}
     Line {N}: `{relevant code excerpt}`
```

---

## Step 4 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rule Check — {N} files scanned
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Clean: {N} files
  ❌ Violations: {M} in {K} files

  {If M > 0:}
  By rule file:
    {rule-file}: {V} violation(s)
      {filename}: {DO NOT rule (truncated to 80 chars)}

  Note: this scan is LLM-based and not exhaustive.
  Violations are probable — review before treating as definitive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Hard Rules

- NEVER modify any file — this skill is purely read-only
- NEVER scan files outside the project root
- Skip unreadable or binary files (note as "skipped — unreadable")
- Do NOT report false positives to avoid noise — when uncertain, omit
- The scan is LLM-based and not exhaustive: violations are probable, not guaranteed
