# Shared spec: WRITE GATE — full detail

The operative rule lives in `CLAUDE.md` §0 (always-active). This spec holds the
supporting detail moved out of CLAUDE.md to keep session context lean. Skills may read
this when they need the full artefact-timing table or the edge-case list.

## Artefact write-timing table

| Artefact | When written |
|---|---|
| `temp/ADO-{ID}-icea.md` | On SAVE PLAN — draft rendering aid, deleted on SAVE ICEA |
| `temp/ADO-{ID}-tech.md` | On SAVE ICEA — draft rendering aid, deleted on SAVE TECH |
| `*.plan.md` | On SAVE PLAN ADO-{ID} |
| `*.icea.md` | On SAVE ICEA ADO-{ID} — after plan saved and ICEA reviewed in temp/ |
| `*.techspec.md` | On SAVE TECH ADO-{ID} — after ICEA saved and Tech Spec reviewed in temp/ |
| `*.epic.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `*.tracker.md` | On SAVE TECH ADO-{ID} — derived, no interaction |
| `memory/` | Automatic on trigger — no gate (Dream pipeline) |
| Source code | Blocked until `APPROVE ADO-{ID}` |
| Config files | Blocked until `APPROVE CONFIG` (no ADO required — see §Config write gate below) |
| Env files (`.env`, `.env.*`) | Hard-blocked if not in `.gitignore` — no approval path |

## Config write gate — `APPROVE CONFIG`

Config file writes via Claude use a lighter approval path than source code — no ADO ID required,
but the gate is still active. Sequence when a skill writes a config file:

1. **Secret scan runs inline** — if credentials are detected, the write is hard-blocked with no
   approval path. Fix the config, then re-request the change.
2. **Prompt shown:**
   ```
   📁 WRITE PENDING — config change
      Path: {full/file/path}
      Secret scan: ✅ clean

      Reply APPROVE CONFIG to write, or SKIP to discard.
   ```
3. **High-risk config** (`azure-pipelines.yml`, `*.tf`, `*.bicep`, IaC, CI/CD): run the RBAC
   check before showing the escalation prompt. If the actor is not in `tech_leads`, block:
   ```bash
   PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
   [ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action APPROVE_CONFIG_HIGH_RISK
   ```
   Read the JSON output:
   - `allowed: false` → show `⛔ BLOCKED — {result.message}`, write RBAC_BLOCK audit event, stop:
     ```bash
     node "$PLUGIN_DIR/scripts/audit-write.cjs" --event RBAC_BLOCK --path "{file-path}" --verdict "blocked" --context "APPROVE_CONFIG_HIGH_RISK: insufficient role" 2>/dev/null || true
     ```
   - `allowed: true` → proceed to the escalation acknowledgment prompt:
   ```
   ⚠ HIGH-RISK CONFIG — this file affects infrastructure/pipeline configuration.
     Confirm you have peer-reviewed this change: reply ACKNOWLEDGE then APPROVE CONFIG.
   ```
4. **Audit entry written** automatically on approval — run best-effort (never blocks):
   ```bash
   PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
   AUDIT_MODEL=$(node -e "try{const e=(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).env||{});console.log(e.REVIEW_MODEL||'claude-sonnet-4-6');}catch(_){console.log('claude-sonnet-4-6');}" 2>/dev/null || echo "claude-sonnet-4-6")
   [ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/audit-write.cjs" \
     --event APPROVE_CONFIG \
     --path "{file-path}" \
     --model "$AUDIT_MODEL" \
     --verdict "approved" \
     --context "Config write approved" 2>/dev/null || true
   ```
5. **Env files** (`.env`, `.env.*`, `.env.local`, etc.): hard-blocked if the file is not in
   `.gitignore`. No `APPROVE CONFIG` path exists — env files must never be committed.

**`APPROVE CONFIG` vs `APPROVE ADO-{ID}`:**
- `APPROVE ADO-{ID}` releases source code writes — requires an active ADO with approved ICEA.
- `APPROVE CONFIG` releases config writes — no ADO required; security gate is the control.
- Both show the diff + path before the prompt. Neither removes visibility.
- `APPROVE ALL ADO-{ID}` covers source code writes only — does NOT blanket config writes.

## The gate holds — no exceptions for source code

The APPROVE requirement applies even when:
- An ICEA has been approved
- The critic has passed
- A previous step already confirmed the approach
- The developer seems impatient or in a hurry

Partial responses do not count as approval. For multiple files, all paths are listed in a
single WRITE PENDING prompt, and a single `APPROVE ADO-{ID}` releases them together.

## Rationale

The gate fires on what the model is about to **produce**, not on what the developer typed
(ADR 0002, output-gated enforcement; ADR 0028, write gate). Keeping the operative rule in
CLAUDE.md (loaded every session) — rather than in a `paths`-scoped rule — is what makes it
fire during planning, before any file is edited.

## Batch / session approval — `APPROVE ALL ADO-{ID}`

Per-file approval is the default and the safest. For a large, already-reviewed multi-file
plan, the developer may grant a **standing** Write-Gate approval for the current plan/ADO.

**RBAC pre-check (runs before granting):** standing approval is a broad action — require
`tech_lead` role. Run before processing `APPROVE ALL ADO-{ID}`:

```bash
PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
[ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/rbac-check.cjs" --action APPROVE_ALL
```

Read the JSON output:
- `allowed: false` → show `⛔ BLOCKED — {result.message}`, write RBAC_BLOCK audit event, stop:
  ```bash
  node "$PLUGIN_DIR/scripts/audit-write.cjs" --event RBAC_BLOCK --ado-id "{ADO_ID}" --verdict "blocked" --context "APPROVE_ALL: insufficient role" 2>/dev/null || true
  ```
- `allowed: true` (or `reason: opt-out-mode`) → proceed to grant the standing approval.

`APPROVE ALL ADO-{ID}` — standing approval for every source/config write in this session's
work on ADO-{ID}. The model still **streams the diff + path for each file before writing it**
(visibility is never removed) but does not stop-and-wait per file.

- **Scope:** current session + current ADO/plan only. Never persists across sessions; a new
  session starts back at per-file approval.
- **Revoke:** `REVOKE ALL ADO-{ID}` (or `STOP BATCH`) returns to per-file `APPROVE ADO-{ID}`.
- **Still shown + auditable:** each write is preceded by its diff + path and a one-line
  `✍ Writing under APPROVE ALL — {path}` marker. When `APPROVE ALL ADO-{ID}` is granted,
  write the standing approval audit event immediately (best-effort):
  ```bash
  PLUGIN_DIR=$(cat .claude/plugin-path.txt 2>/dev/null || echo "")
  AUDIT_MODEL=$(node -e "try{const e=(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).env||{});console.log(e.REVIEW_MODEL||'claude-sonnet-4-6');}catch(_){console.log('claude-sonnet-4-6');}" 2>/dev/null || echo "claude-sonnet-4-6")
  [ -n "$PLUGIN_DIR" ] && node "$PLUGIN_DIR/scripts/audit-write.cjs" \
    --event APPROVE_ALL \
    --ado-id "{ADO_ID}" \
    --model "$AUDIT_MODEL" \
    --verdict "standing-approval-granted" \
    --context "APPROVE ALL granted for ADO-{ADO_ID}" 2>/dev/null || true
  ```
- **Does NOT widen scope:** covers only files within the approved plan's Change Manifest /
  stated file set; a write outside that set falls back to a per-file WRITE PENDING prompt.
- **Does NOT blanket a repo-boundary crossing:** see below.

## Boundary-crossing writes — dependency repos (`additionalDirectories`)

Read access to a locally-cloned dependency repo (a path in `.claude/settings.local.json →
additionalDirectories`; see `multi-root-scan.md`) does **not** imply write consent. When a write
target resolves to an absolute path **outside the repo root**:

- It **always** requires its own explicit per-file confirmation, and **`APPROVE ALL ADO-{ID}`
  does NOT blanket it** — a standing batch approval covers in-repo writes only.
- Show the diff + full path, then stop with an extra line before the standard prompt:
  ```
  ⚠ WRITE CROSSES REPO BOUNDARY — {path} is outside this repo (dependency: {dep root}).
  📁 WRITE PENDING — reply APPROVE ADO-{ID} to write, or SKIP to discard.
     Path: {full/file/path}
  ```
- Rationale: writing into a sibling repo you merely depend on is a distinct, higher-blast-radius
  action than writing your own source; it must never happen silently. `icea-implement` is the
  primary caller — a Tech Spec may legitimately name a dependency path (multi-root graph), but the
  write still stops here.

## Gate orthogonality — the gates guard different risks

Independent gates; never collapse them into one switch:

| Gate | Guards against | Skippable? |
|---|---|---|
| Feature Gate (ICEA) | building without thinking | `/skip-icea` (Feature Gate ONLY; warns once) |
| Write Gate (per-file APPROVE) | wrong path, hallucinated content, clobbering | `APPROVE ALL ADO-{ID}` removes the per-file *pause* — never the visibility |
| Secrets scan | leaking credentials | NEVER — no flag (`secrets-scan-spec.md`) |
| Findings gate | shipping known Critical/High | `--skip-security-gate` + written justification only |

`/skip-icea` never affects the Write/Secrets/Findings gates. `APPROVE ALL` never affects the
Feature/Secrets/Findings gates. Secrets is never skippable by any flag. A future "fast mode"
may compose ONLY the skippable gates, must be loudly logged, and STILL shows diffs.
Rejected: a single "no gates" flag — it conflates orthogonal risks and removes the last line
of defence before an irreversible disk write.
