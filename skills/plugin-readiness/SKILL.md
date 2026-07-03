---
name: plugin-readiness
description: >
  Assesses whether the Claude Code plugin is production ready from an AI Architect
  perspective. Evaluates 6 domains: infrastructure health, model routing, memory health,
  governance rails, skill quality, and session budget. Reads plugin state only — no
  application source files. Produces an HTML report.
  Triggered by: "is the plugin production ready", "plugin readiness", "AI readiness",
  "AI architecture review", "plugin health", "is the plugin ready", "AI governance review".
---

# Plugin Production Readiness Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
Assesses whether the Claude Code plugin is configured, governed, and healthy enough
to support a production development team. Reads plugin state files only — no source reads.

---

## Model routing

This skill is in the **infrastructure tier** — uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

See `../shared/model-routing-spec.md`.

---

## Source file consent

This skill is **Category C** — never reads application source files.
It reads only plugin state files: `plugin.json`, `.claude/architecture/`, `memory/`,
`CodeReviews/`, `security/`, `docs/icea/`, and `token-analysis/`.

---

## Step 0 — Announce scope

```
🤖 Plugin Production Readiness Assessment
  Reads: plugin state files only (no application source)
  Domains: AI-1 Infrastructure · AI-2 Model Routing · AI-3 Memory Health
           AI-4 Governance Rails · AI-5 Skill Quality · AI-6 Session Budget
```

---

## Step 1 — Collect plugin state evidence

Run all of these. Record the output — it drives every domain score.

```bash
echo "=== Plugin version ==="
python3 -c "import json; p=json.load(open('.claude-plugin/plugin.json')); print('VERSION:', p['version']); print('MODELS:', json.dumps(p.get('recommended_models',{}), indent=2))" 2>/dev/null

echo "=== dream-status checks ==="
# Check each of the 17 dream-status items directly
ls CLAUDE.md memory/MEMORY.md memory/dream-log.md 2>/dev/null
ls .claude/rules/ .claude/commands/ .claude/architecture/ 2>/dev/null
ls .claude/graph/graph-index.md .claude/file-cache.json 2>/dev/null
ls token-analysis/token-graph.json 2>/dev/null

echo "=== rules sync check ==="
node -e "
const fs   = require('fs');
const path = require('path');
const STACK_RULES = {
  dotnet:           'dotnet-rules.md',
  dotnet_framework: 'dotnet-framework-rules.md',
  angular:          'angular-rules.md',
  nodejs:           'nodejs-rules.md',
  javascript:       'javascript-rules.md',
  java:             'java-rules.md',
  python:           'python-rules.md',
};
try {
  const state  = JSON.parse(fs.readFileSync('.claude/dream-init-state.json','utf8'));
  const stacks = state.detected_stacks || [];
  const missing = stacks
    .filter(s => STACK_RULES[s])
    .map(s => STACK_RULES[s])
    .filter(f => !fs.existsSync(path.join('.claude/rules', f)));
  if (!fs.existsSync('.claude/rules/project-rules.md')) missing.unshift('project-rules.md');
  if (missing.length > 0) {
    console.log('RULES_MISSING: ' + missing.join(', '));
  } else {
    console.log('RULES_IN_SYNC');
  }
} catch(e) { console.log('RULES_STATE_UNREADABLE'); }
" 2>/dev/null

echo "=== architecture-deployment.md ==="
ls .claude/architecture/architecture-deployment.md 2>/dev/null || echo "MISSING"
grep -c "Not yet answered" .claude/architecture/architecture-deployment.md 2>/dev/null || echo "0"

echo "=== Memory health ==="
wc -l memory/MEMORY.md 2>/dev/null
ls memory/topic-*.md 2>/dev/null | wc -l
tail -20 memory/dream-log.md 2>/dev/null

echo "=== Model overrides ==="
python3 -c "
import json
try:
    s = json.load(open('.claude/settings.json'))
    env = s.get('env', {})
    print('ICEA_MODEL:', env.get('ICEA_MODEL','not set (default)'))
    print('REVIEW_MODEL:', env.get('REVIEW_MODEL','not set (default)'))
    print('INFRA_MODEL:', env.get('INFRA_MODEL','not set (default)'))
except: print('NO_SETTINGS_FILE')
" 2>/dev/null

echo "=== ICEA governance ==="
ls docs/icea/ 2>/dev/null | head -10
ls docs/icea/ 2>/dev/null | wc -l

echo "=== Code review ledger ==="
ls CodeReviews/code-review-ledger.md 2>/dev/null || echo "MISSING"
grep "Status.*Fixed\|Status.*Open" CodeReviews/code-review-ledger.md 2>/dev/null | \
  awk -F': ' '{print $2}' | sort | uniq -c 2>/dev/null

echo "=== Security reports ==="
ls security/ 2>/dev/null | sort -r | head -3
# Check for B1-B7 override annotations in most recent report
grep -l "Override reason\|business override\|B[1-7]" security/*.html 2>/dev/null | head -1

echo "=== gitignore coverage ==="
for f in ".claude/settings.json" ".claude/settings.local.json" ".claude/security-checkpoint.json" ".claude/code-review-checkpoint.json" ".claude/file-cache.json" ".claude/dream-init-state.json" ".claude/architecture/" "CodeReviews/" "security/" "dynamic-scan/" "token-analysis/" "prod-readiness/" "memory/health.html"; do
  grep -q "$f" .gitignore 2>/dev/null && echo "COVERED: $f" || echo "MISSING: $f"
done

echo "=== Token analysis ==="
python3 -c "
import json
try:
    g = json.load(open('token-analysis/token-graph.json'))
    sessions = g.get('sessions', {})
    print('SESSIONS_CACHED:', len(sessions))
    # Check for context limit hits
    hits = [s for s in sessions.values() if s.get('tokens', 0) > 85000]
    print('CONTEXT_LIMIT_HITS:', len(hits))
except: print('NO_GRAPH')
" 2>/dev/null

echo "=== Last dream run ==="
grep "^### dream —\|^## dream —" memory/dream-log.md 2>/dev/null | tail -3

echo "=== PR compliance ==="
# Count recent PRs with ICEA compliance badge in description
# Can't check ADO directly without PAT, so check local ICEA file recency
find docs/icea/ -name "*.md" -newer memory/MEMORY.md 2>/dev/null | wc -l
```

---

## Step 2 — Score all 6 AI domains

**Maturity scale (same as app-readiness):**
1 = Not started · 2 = Ad hoc · 3 = Defined · 4 = Managed · 5 = Optimised

---

### AI-1: Plugin infrastructure health

Evaluate the 17 dream-status checks from the evidence collected in Step 1.

| Check | Evidence | Score signal |
|---|---|---|
| CLAUDE.md present | File exists | Required |
| memory/ both files | Both present | Required |
| .claude/rules/ in sync | `RULES_IN_SYNC` emitted — all expected rule files present for detected stacks | Required |
| .claude/commands/ 22 stubs | Count = 22 | Required |
| .claude/architecture/ populated | No `<!-- TEMPLATE -->` markers | Required |
| knowledge graph exists | `.claude/graph/graph-index.md` present + module detail files | Required |
| file-cache.json seeded | File present | Required |
| token-graph.json seeded | File present | Required |
| .gitignore coverage | All 13 entries covered | Required |
| dream-rollback log | No unresolved rollback | Good signal |
| Model versions reviewed | last_reviewed within cadence | Required |
| architecture-deployment.md present | File exists at `.claude/architecture/architecture-deployment.md` | Required for prod |
| architecture-deployment.md answered | `grep -c "Not yet answered"` returns 0 | Required for prod |
| dream-init plugin version | `dream_init_plugin_version` in state matches current `plugin.json` version | Good signal |

If `RULES_MISSING` is emitted instead of `RULES_IN_SYNC`, mark the rules check
❌ Red and include in the report:
```
❌ .claude/rules/ out of sync — missing: {file list}
   Cause: plugin was updated after dream-init last ran.
   Fix  : run /dream-init to deploy the missing rule files.
```

If `RULES_STATE_UNREADABLE` is emitted (no dream-init-state.json or no
`detected_stacks` key), mark as ⚠ Yellow — project may not have run
`dream-init` with v1.20.4 or later.

Score 1: 4 or more ❌ Red checks.
Score 2: 2–3 ❌ Red checks.
Score 3: All ✅ Green except non-critical items (dream-rollback, skill usage, plugin version match).
Score 4: All 14 ✅ Green.
Score 5: Score 4 + all governance rails active (security scan <30 days, ICEA files current).

---

### AI-2: Model routing appropriateness

Evidence: `plugin.json` recommended_models, settings.json overrides.

| Check | Signal |
|---|---|
| `ICEA_MODEL` set or default `claude-opus-4-6` | Generation tier appropriate |
| `REVIEW_MODEL` set or default `claude-sonnet-4-6` | Review tier appropriate |
| `INFRA_MODEL` set or default `claude-sonnet-4-6` | Infrastructure tier configured |
| `last_reviewed` within `review_cadence_days` | Defaults are current |
| No override forcing Haiku on generation tier | Critical — spec quality matters |
| No override forcing Opus on infra for simple tasks unnecessarily | Cost signal |

Score 1: No model routing configuration, using defaults from before v1.7.
Score 2: ICEA_MODEL and REVIEW_MODEL set but INFRA_MODEL missing.
Score 3: All three tiers configured, defaults current.
Score 4: Score 3 + last_reviewed within cadence, overrides documented in CLAUDE.md.
Score 5: Score 4 + token-analysis shows model usage matching tier assignments.

---

### AI-3: Memory and context health

Evidence: MEMORY.md line count, topic file count, dream-log last run, health.html if present.

| Check | Healthy signal | Warning signal |
|---|---|---|
| MEMORY.md line count | < 150 lines | > 200 lines (approaching token-budget limit) |
| Topic files count | < 8 | > 10 (consolidation needed) |
| Last dream run | < 10 sessions ago | > 15 sessions ago |
| dream-log entries | 3+ runs recorded | 0 runs (never consolidated) |
| MEMORY.md content | Reflects current architecture | References old file paths or removed features |

Score 1: Dream never run. MEMORY.md is the default empty template.
Score 2: Dream run once but months ago. MEMORY.md stale relative to current codebase.
Score 3: Dream run regularly (< 15 sessions). Memory reflects current state.
Score 4: Score 3 + MEMORY.md < 100 lines, topic files < 5, health.html generated.
Score 5: Score 4 + memory entries have high confidence scores, stale entries pruned.

---

### AI-4: Governance rails

Evidence: docs/icea/ content, code-review ledger, security report B1–B7 annotations, PR patterns.

| Check | Evidence signal |
|---|---|
| ICEA files present for recent work | docs/icea/ contains recent ADO-*.md files |
| ICEA files cover recent ADO items | File count > 0 and files modified recently |
| Code review findings are getting Fixed | Ledger shows Fixed entries, not only Open accumulation |
| Security scan run recently | security/ has a report from < 30 days |
| B1–B7 override annotations present | At least one finding shows business context override |
| PR compliance in use | pr-describe/pr-create used (infer from ICEA file recency) |

Score 1: No ICEA files, no code review ledger, no security scan.
Score 2: ICEA files exist but sparse — most ADO items have no ICEA.
Score 3: ICEA files present for most recent items. Security scan < 30 days old.
Score 4: Score 3 + ledger shows Fixed findings, B1–B7 overrides observed.
Score 5: Score 4 + ICEA compliance rate visible in sprint-metrics, governance improving.

---

### AI-5: Skill quality and consent governance

Evidence: shared spec versions, skill SKILL.md files for spot-check.

```bash
echo "=== Shared spec versions ==="
head -2 skills/shared/graph-index-schema.md 2>/dev/null
head -2 skills/shared/graph-module-schema.md 2>/dev/null
head -2 skills/shared/scope-flags-spec.md 2>/dev/null
head -2 skills/shared/source-file-consent.md 2>/dev/null
head -2 skills/shared/business-context-severity.md 2>/dev/null

echo "=== Consent categories complete ==="
# Check that all review skills reference source-file-consent
grep -l "source-file-consent\|Category A\|Category B" \
  skills/icea-review/SKILL.md \
  skills/pr-spec-review/SKILL.md \
  commands/code-review.md \
  commands/security-review.md 2>/dev/null | wc -l

echo "=== Budget cap in scope ==="
grep -c "FILE_BUDGET\|40 file\|budget cap" \
  skills/security/SKILL.md \
  skills/code-review/SKILL.md 2>/dev/null
```

| Check | Required for production |
|---|---|
| graph-index-schema.md + graph-module-schema.md (per-module fingerprint) | ✓ |
| scope-flags-spec.md v1.2 (--area, budget cap) | ✓ |
| source-file-consent.md present | ✓ |
| business-context-severity.md B1–B7 complete | ✓ |
| All review skills reference consent spec | ✓ |
| Budget cap in security and code-review | ✓ |

Score 1: Shared specs missing or pre-v1.6 versions.
Score 2: Some specs present but consent governance not wired into review skills.
Score 3: All shared specs present at correct versions. Consent in all review skills.
Score 4: Score 3 + budget cap enforced. --area and --continue flags working.
Score 5: Score 4 + all 169 structural validator checks passing.

---

### AI-6: Session budget and context health

Evidence: token-graph context limit hits, scope flag usage.

| Check | Healthy signal |
|---|---|
| No sessions hitting context limit | token-graph shows 0 sessions > 85K tokens |
| --area flags in use for large codebases | Evidence from recent security/code-review scope reports |
| File budget cap configured | scope-flags-spec.md v1.2 |
| Security SKILL.md slimmed (< 700 lines) | Context cost reduced |

Score 1: 3+ sessions hit context limit. No mitigations in place.
Score 2: Context limit hit at least once. --area flags not yet in use.
Score 3: Budget cap configured. --area flags available. No recent context limit hits.
Score 4: Score 3 + token-analysis shows consistent session sizes well under limit.
Score 5: Score 4 + --area workflow adopted by all developers, session budget monitored.

---

## Step 3 — Apply business context severity

Even for AI/plugin findings — if the plugin's failure to enforce governance results in
real client data being exposed or privilege being breached, that is a B1–B7 finding.

Specific trigger: if AI-4 (Governance) shows no security scan and the application
handles B1–B7 data → that is a blocking finding.

---

## Step 4 — Verdict

| Verdict | Condition |
|---|---|
| ✅ **Plugin ready** | All 6 domains ≥ 3 AND the enforcement floor is installed and current (dream-status check 1p green) or formally declined with a recorded opt-out. |
| ⚠️ **Conditionally ready** | AI-1 and AI-4 ≥ 3. AI-2, AI-3, AI-5, AI-6 may be at 2. |
| 🔶 **Not ready** | AI-1 (Infrastructure) or AI-4 (Governance) < 3, OR the enforcement floor is absent without a recorded opt-out (check 1p red). |
| 🔴 **Blocked** | Any domain at 1, OR security scan never run on a B1–B7 application. |

Critical domains: AI-1 (Infrastructure health), AI-4 (Governance rails).
A "ready" verdict with no mechanical floor would be exactly the kind of
overclaim this assessment exists to prevent — the floor (or its attributable
decline) is a hard requirement, not a scored domain.

---

## Step 5 — Generate HTML report

Write to `prod-readiness/plugin-readiness-{date}.html`.

```bash
mkdir -p prod-readiness
```

Report structure:
1. **Executive summary** — overall verdict, score grid (6 domains RAG), top 3 actions
2. **Infrastructure status** — the 17 dream-status checks summarised
3. **Domain findings** — each domain with score, evidence, gaps, specific fixes
4. **Remediation roadmap** — Before go-live / Within 30 days / Next sprint
5. **Strengths** — what is working well

---

## Hard Rules

- NEVER read application source files — only plugin state files
- NEVER score AI-4 above 2 if no security scan has been run on a B1–B7 application
- NEVER skip the business context check in Step 3
- NEVER invent memory health scores — compute from file sizes and log dates
