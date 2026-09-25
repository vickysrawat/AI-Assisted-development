# Skill: icea-approve

_Skill version: 1.0 · Last changed: 2026-07-07 · Consent: C_

> **Business context severity:** approves ICEAs whose acceptance criteria carry B-series
> sensitivity flags — see `$PLUGIN_DIR/skills/shared/business-context-severity.md`.

## Purpose
Approve an ICEA and Tech Spec by ADO ID. Works in any session, including
after a session gap. State is read entirely from disk — no conversation
context required.

Triggered by:
- `/icea-approve ADO-1847`
- `APPROVE ADO-1847`
- `APPROVE ADO-1847 Story-2`

---

## Persona
Acts with a **[TL] Tech Lead** lens — confirm the ICEA/Tech Spec are genuinely ready before
approving; always asks "is this actually complete and sound?" Lens only; never assume, never
attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Step 1 — Resolve ADO ID

Extract ADO ID from the command argument or keyword input.
Normalise: ADO-1847, ADO #1847, and 1847 all resolve to the same ID.

If missing, ask:
```
Which ICEA would you like to approve?
  ADO #: [e.g. ADO #1847]
```

---

## Step 2 — Locate files on disk

```bash
find docs -name "ADO-${ADO_ID}-*.icea.md" 2>/dev/null
find docs -name "ADO-${ADO_ID}-*.techspec.md" 2>/dev/null
```

If no files found:
```
⚠ No ICEA found for ADO #{ADO_ID}.
  To create one: /icea-feature ADO-{ADO_ID}
```
Stop here.

Extract RELEASE_ID, SPRINT_ID, EPIC vs STORY structure, and feature
slug from the path.

---

## Step 3 — Check current status

Read the `Status:` line from the ICEA file.

| Status found | Action |
|---|---|
| `Status: DRAFT` | Proceed to Step 4 |
| `Status: DRAFT — Revising` | Proceed to Step 4 |
| `Status: ✅ Approved` | Inform developer, ask if they want to implement |
| `Status: IN PROGRESS` | Inform developer, direct to `IMPLEMENT ADO-{ID}` |
| `Status: COMPLETE` | Inform developer this ICEA is complete, no action needed |

---

## Step 3a — Test plan gate

Check whether a QA test plan has been generated for this ADO:

```bash
find docs -path "*UserStory${ADO_ID}*" -name "ADO-${ADO_ID}-*.test-plan.md" 2>/dev/null
```

**If found:** record `TEST_PLAN_EXISTS=true`. Continue to Step 3b.

**If not found and no `--skip-test-gate` flag:** hard-block —

```
⛔ TEST PLAN REQUIRED — no test plan found for ADO #{ADO_ID}.

   The test plan is part of the approval artefact set (ICEA + Tech Spec + test plan)
   and must exist on disk before APPROVE.

   Run SAVE TEST ADO-{ADO_ID} to generate the QA test plan first.

   To bypass (spike or prototype only):
     APPROVE ADO-{ADO_ID} --skip-test-gate
   ⚠ Bypass writes an audit entry visible in tech lead review.
```

Stop here.

**If `--skip-test-gate` flag present:** write audit entries immediately (best-effort, never blocks) —

```bash
node .claude/hooks/audit-append.cjs "{\"event\":\"gate.test-plan-skip\",\"action\":\"SKIP\",\"ado\":\"${ADO_ID}\",\"result\":\"bypassed\",\"source\":\"icea-approve\",\"justification\":\"--skip-test-gate flag\"}" 2>/dev/null || true
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
AUDIT_MODEL=$(node -e "try{const e=(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).env||{});console.log(e.ICEA_MODEL||'claude-opus-4-8');}catch(_){console.log('claude-opus-4-8');}" 2>/dev/null || echo "claude-opus-4-8")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/audit-write.cjs" --event BYPASS_TEST_GATE --ado-id "${ADO_ID}" --model "$AUDIT_MODEL" --verdict "bypassed" --context "--skip-test-gate flag" 2>/dev/null || true
```

Record `TEST_PLAN_EXISTS=bypass`. Continue to Step 3b.

---

## Step 3b — Light ICEA gap check

Perform a heuristic scan of the ICEA `## Examples` section to detect test-generation
blockers before implementation starts. This is an early-warning check — the full
authoritative gap analysis runs at IMPLEMENT time.

For each Example in the ICEA `## Examples` section, check:
1. If the Example references a dependency by name (e.g. "calls `IUserRepository.GetById`",
   "uses `IEmailService.Send`"), check whether that dependency's contract appears in `## Context`
   (interface definition, return type, or behaviour description).
2. If the Example specifies a result, check that the result is concrete (a specific value, an
   object shape, a state change) — not just "returns success", "completes", or "works correctly".

**If all Examples pass:** record `ICEA_GAP=clean` — show nothing in Step 4 summary.

**If any Example fails the check:** record the specific failures as `ICEA_GAP_WARNINGS[]`.
These are shown in the Step 4 summary as a non-blocking warning — full gap enforcement
(with ICEA annotation and implementation block) happens at IMPLEMENT time.

---

## Step 4 — Present lightweight summary for approval

The files already exist on disk and have been reviewed by the Tech Lead
and Product team. Do NOT re-display full ICEA content — show only what
is needed to confirm the right document is being approved:

```
📋 ICEA APPROVAL — ADO #{ADO_ID} · Release {R} · Sprint {S}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICEA:      {path} — Status: {current Status line}
TechSpec:  {path}
Test plan: {path}  ← or "⚠ SKIPPED (--skip-test-gate — audit entry written)" if bypass

Intent:   {one line summary from ICEA Intent section}
Type:     {STORY / EPIC}
Total SP: {total from `## Sizing and Story Breakdown` section of Tech Spec}
Open questions remaining: {count — 0 if none}
  ❓ [{N}] {topic}  ← list only if count > 0

{Include the following block only if ICEA_GAP_WARNINGS[] is non-empty:}
⚠ ICEA gap warning — {N} Example(s) may not generate complete unit tests at IMPLEMENT time:
  • Example {N}: {gap description — e.g. "IUserRepository contract missing from Context"}
  • Example {N}: {gap description — e.g. "expected result not concrete: 'returns success'"}
  Run REVISE ADO-{ADO_ID} to fix before implementation, or proceed and resolve at IMPLEMENT time.
  (These are ICEA defects — IMPLEMENT will hard-block if unresolved.)

Reply APPROVE ADO-{ADO_ID} to approve.
⛔ If any ICEA Open Question is unresolved (not answered, not deferred-with-justification),
   approval is BLOCKED — run REVISE ADO-{ADO_ID} to resolve or defer them first.
```

---

## Step 5 — Write approval to disk

On receiving `APPROVE ADO-{ADO_ID}`:

0. **Open Questions gate (blocking, per `icea-schema.md` gate 6):** read the ICEA
   `### Open Questions` section. If any row is `open` (neither `answered` nor
   `deferred` with written justification), do NOT approve — output the unresolved
   questions and tell the developer to run `REVISE ADO-{ADO_ID}`. This is the only
   hard gate on ICEA approval; there is no bypass keyword.
1. Write `Status: ✅ Approved` to the ICEA file
2. Append revision log entry:
   ```
   {date} — Approved
   ```
2b. Record the approval outcome in both audit systems (best-effort — never blocks):
   ```bash
   node .claude/hooks/audit-append.cjs "{\"event\":\"gate.approve\",\"action\":\"APPROVE\",\"ado\":\"${ADO_ID}\",\"result\":\"granted\",\"source\":\"icea-approve\"}" 2>/dev/null || true
   AUDIT_MODEL=$(node -e "try{const e=(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).env||{});console.log(e.ICEA_MODEL||'claude-opus-4-8');}catch(_){console.log('claude-opus-4-8');}" 2>/dev/null || echo "claude-opus-4-8")
   node "$PLUGIN_DIR/scripts/audit-write.cjs" --event APPROVE_ADO --ado-id "${ADO_ID}" --model "$AUDIT_MODEL" --verdict "approved" --context "ICEA approved" 2>/dev/null || true
   ```
   Note: `audit-write.cjs` records actor identity and role (from `.claude/ApprovalRoles.json`)
   in a per-event JSON file under `.claude/audit/`. The `audit-append.cjs` call is the existing
   shard-based trail; both coexist. If the feature's `.ai-audit.md` exists, also append an
   `Approved` row with the resolved `$ACTOR` in the User cell (resolve via
   `require('.claude/hooks/audit-append.cjs').resolveIdentity()`).
3. Write immediately once the Open Questions gate (Step 0) passes — no other gate applies
4. Output the ADO work item description block (ready to paste into ADO):
   Read `.claude/plugin-path.txt` to get `PLUGIN_DIR` (if absent, use the Node.js resolver from
   `skills/shared/plugin-path-resolution.md §1a`), then see format in
   `$PLUGIN_DIR/skills/icea-feature/references/ado-description-template.md`
5. Confirm:

```
✅ ICEA Approved — ADO #{ADO_ID}
   Status written to: {icea path}

ADO description block above is ready to paste into your work item.

To start implementation:
  IMPLEMENT ADO-{ADO_ID}

For an Epic, implement story by story:
  IMPLEMENT ADO-{ADO_ID} Story-1

To check status at any time:
  STATUS ADO-{ADO_ID}
```

Do NOT generate any implementation code here. Implementation is a separate skill.
