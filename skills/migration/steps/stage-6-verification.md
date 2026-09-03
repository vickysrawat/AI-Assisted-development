# Migration Step — Stage 6: Verification

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Final stage._

**Persona:** [SE] Elena Fischer — Senior Software Engineer. **Model tier:** `${REVIEW_MODEL:-claude-sonnet-4-6}`.
**Checkpoint:** single source of truth (schema 1.10); on completion merge `phase = "Complete"` — only
after `stage_gates.asbuilt_reconciled = true` (Step 6.5).

---

## Stage 6 — Verification

### Step 6.1 — Full build + unit tests

```
{profile BUILD — Release}
{profile TEST_ALL}
```

**After a green Release build — run the deferred oracle replays.**
- **Golden-master (Step 5.0, Steps 3–4):** the recordings captured at Step 5.0 now have a built TARGET
  to replay against: execute the replay + diff, write `docs/.../ADO-{ADO_ID}-golden-master-report.md`,
  and carry any HIGH-risk drift / error to the completion gate (Step 6.6). (Skip only if Step 5.0
  recorded `⚠ No external oracle`.)
  - **M4 — B-series weighting.** Behavioral drift on a path flagged B-series (per the Entity Map
    B-series column / the target's `.claude/business-context.md`) — e.g. a changed
    privileged/PHI/PCI access path, a deadline/transaction calculation — escalates to
    **Critical/blocking** regardless of the generic behavioral-risk rating, and MIGRATION COMPLETE
    is withheld until explained. This separates "compiles but subtly changed a regulated code path"
    from cosmetic diffs.
- **Frontend-parity (Step 5.4, Tier 2 — frontend run only):** if journeys were captured at Step 5.4,
  replay them against the served target (spec Step 3), write
  `docs/.../ADO-{ADO_ID}-frontend-parity-report.md`, and inject every drift as a mandatory row in the
  Step 6.4 Tier-1 disposition. **Advisory — drift does NOT hard-block here.** (Skip if Step 5.4
  recorded `⚠ No frontend oracle`.)

### Step 6.2 — Automated E2E (Playwright — headless, no LLM during execution)

Pre-flight: run the profile `CONFIG` check — fail if the target's dev config still holds placeholder
connection strings/URLs.

Start the target using the profile `SERVE` (+ health probe). A **backend run** serves the backend; a
**frontend run** serves the Angular app and points it at the **consumed contract's backend URL** (the
published/existing backend it talks to). Acquire a test token per the approved SECURITY-ARCHITECTURE.md
auth strategy (Entra ID client_credentials / custom-JWT endpoint / API-key env var / none).

Run the profile `E2E` harness headless, then stop the started process(es). A non-zero exit → E2E
failed (see the harness report).

### Step 6.3 — Architecture fitness (if developer chose Yes during architecture review)

```
{profile FITNESS}
```

### Step 6.4 — Frontend parity session (Tier 1) / Visual verification (for developer)

**For a `frontend` run this is the Tier-1 manual parity session from `frontend-parity-spec.md` — the
primary, always-on, human-dispositioned parity gate** (it runs whether or not the source can be driven
live). Generate `## Frontend Parity Session — ADO-{ADO_ID}` from the Stage 0.6 inventory, one row per
inventory feature-ID whose Layers include **UI** and that is `GM-verifiable = yes` OR high-risk, PLUS
every `mappings/angular-react.md` **RED** behavioural-risk item (auto-tracking/effects, Zone.js
re-render model, two-way binding, complex RxJS orchestration). Grouped by cluster, each row states the
**verbatim** expected outcome from the inventory G/W/T:
```markdown
## Frontend Parity Session — ADO-{ADO_ID}
Start: {profile SERVE — dev-run command}  (frontend run: `ng serve`/`npm run dev` + the consumed backend URL)

### Cluster: {ClusterName}
  [ ] F-07 reject empty order name
        expected: stay on /orders/new; show "Name is required"   (verbatim — inventory G/W/T)
        check:    target — submit empty form; {source — same, if runnable}
        result:   PASS | DRIFT: {note} | BLOCKED
  [ ] F-19 sign-in redirect  (HIGH — RED: guard→loader paradigm shift)
        expected: navigate to /dashboard; greet user; nav shows Orders/Invoices/Admin
        check:    target — sign in; {source — same, if runnable}
        result:   PASS | DRIFT | BLOCKED
  [ ] Health: {profile SERVE — health endpoint} → healthy
```
**Disposition is the human gate:** every high-risk / must-preserve feature-ID must be `PASS` or
`DRIFT-accepted: {reason}` before the completion banner; unmarked items BLOCK completion. Any Tier-2
advisory drift (Step 6.1 replay) is injected here as a mandatory row. For a **backend/upgrade run**,
generate the generic post-migration spot-check instead (sign-in, one list, one create form, one error
state, health). Run `/verify` for interactive browser-driven testing.

### Step 6.5 — As-built reconciliation (GATED — blocks MIGRATION COMPLETE)

Design-time ≠ as-built: the Stage 1/3 architecture docs were written *before any code existed*. This
step reconciles that intent against the code that was actually generated. It is a **gate**, not the
post-completion suggestion it used to be. When golden-master was SKIPPED (source can't run), this
mechanical audit is the **required compensating control** — it is the only structural net left.

```
Read $PLUGIN_DIR/skills/migration/references/specs/asbuilt-reconciliation-spec.md
```

1. **Regenerate the as-built orientation layer from real code.** Run `architect` + `/graph-sync` (via
   `/setup-init`) in the TARGET so `.claude/architecture/*` and `.claude/graph/*` are populated from the
   generated code — not the design docs. `.claude/architecture/*` becomes the **as-built source of
   truth**; the migration docs remain the design/decision record. If architect cannot fully analyze
   (e.g. the target does not yet build), record the limitation and mark the affected checks
   **`NOT mechanically verified`** in the report — never let an un-analyzable area pass silently.
2. **Run the mechanical audit** per `asbuilt-reconciliation-spec.md`: endpoints (routes verb+template),
   authorization (role attributes, class∧action), external dependencies (generated clients / DI
   registrations vs. the §8 Integration Inventory), and config + libraries (`appsettings.json` keys,
   logging/cache/test packages). Declarative-mechanical extraction for .NET / Java-Spring / Angular
   targets; **labeled best-effort fallback** (marked `NOT mechanically verified`) for Node/Express /
   React / Python — never a false "reconciled" pass on an imperative stack.
3. **Write the divergence report** `docs/.../ADO-{ADO_ID}-asbuilt-reconciliation.md` (format in the
   spec): the design-vs-as-built diffs (e.g. endpoint 57≠49, phantom roles, service-vs-DB, missing
   libraries), each classified, plus any open integration blocker carried from Stage 0.6.
4. **Stamp each Stage-1 design doc** with the supersession banner at the top:
   `> ⚠ DESIGN-TIME SNAPSHOT — superseded by .claude/architecture/*; see ADO-{ADO_ID}-asbuilt-reconciliation.md for divergences.`
5. **Set the gate:** merge `stage_gates.asbuilt_reconciled = true` **only when** the report was produced
   AND every Stage-1 doc was stamped. Unresolved HIGH-severity divergences are surfaced to the developer
   like golden-master drift (Step 6.5 is analogous to Step 6.1's oracle gate) — completion is withheld
   until they are explained or accepted, exactly as with GM drift.

### Step 6.6 — Generate MIGRATION-REPORT.md

Load spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/migration-report-spec.md
```

Write `docs/.../ADO-{ADO_ID}-migration-report.md` (include the As-Built Reconciliation + Integration
Verification sections). Then, only if `stage_gates.asbuilt_reconciled = true`, update the checkpoint
(merge): `phase = "Complete"` — `/migration-status` then renders it complete.

### Completion

```
✅ MIGRATION COMPLETE — ADO-{ADO_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Source:    {SOURCE_PATH} ({source stack})
  Target:    . ({target stack})
  Clusters:  {N} migrated · {N branches merged}
  Tests:     {N} passing
  E2E:       {N} passing (headless Playwright)
  Golden-master: {N} match · {N} drift (all explained) · coverage {FULL|PARTIAL|INFERRED}
  Frontend-parity: {frontend run: N match · N drift-dispositioned · {FULL|MANUAL|SKIPPED} | n/a}
  As-built recon: {N divergences ({N HIGH explained/accepted})} · audit {MECHANICAL|PARTIAL — some NOT mechanically verified}
  Coverage:  {backend%} {| frontend%}

  As-built source of truth (built from generated code at Step 6.5):
  • .claude/architecture/*   ← current; consult this first
  Design-time snapshots (stamped superseded at Step 6.5):
  • docs/.../COMPONENT-ARCHITECTURE.md · DATA · SECURITY · INFRASTRUCTURE · ARCHITECTURE-DECISIONS.md
  • docs/.../ADO-{ADO_ID}-asbuilt-reconciliation.md   ← design-vs-as-built divergences

  Next:
  1. Review ADO-{ADO_ID}-asbuilt-reconciliation.md and resolve any remaining divergences
  2. Complete visual verification checklist
  3. Populate the profile CONFIG dev file (e.g. connection strings) with real values
  4. {SOURCE_PATH} remains in additionalDirectories until validated

  Cleanup: rm .claude/migration-checkpoint.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

