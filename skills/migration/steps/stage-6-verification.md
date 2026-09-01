# Migration Step — Stage 6: Verification

_Part of the `migration` skill. Loaded and dispatched by the orchestrator
(`skills/migration/SKILL.md`) — not a standalone/registered skill. Final stage._

**Persona:** [SE] Elena Fischer — Senior Software Engineer. **Model tier:** `${REVIEW_MODEL:-claude-sonnet-4-6}`.
**Checkpoint:** single source of truth (schema 1.9); on completion merge `phase = "Complete"`.

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
  and carry any HIGH-risk drift / error to the Step 6.5 completion gate. (Skip only if Step 5.0
  recorded `⚠ No external oracle`.)
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

### Step 6.5 — Generate MIGRATION-REPORT.md

Load spec:
```
Read $PLUGIN_DIR/skills/migration/references/specs/migration-report-spec.md
```

Write `docs/.../ADO-{ADO_ID}-migration-report.md`.
Update the checkpoint (merge): `phase = "Complete"` — `/migration-status` then renders it complete.

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
  Coverage:  {backend%} {| frontend%}

  Architecture docs:
  • docs/.../COMPONENT-ARCHITECTURE.md
  • docs/.../DATA-ARCHITECTURE.md
  • docs/.../SECURITY-ARCHITECTURE.md
  • docs/.../INFRASTRUCTURE-ARCHITECTURE.md
  • docs/.../ARCHITECTURE-DECISIONS.md

  Next:
  1. /setup-init — completes the full rule set (project + {target} language rules were already
     deployed at Step 3.3a), builds the knowledge graph, and populates architecture docs
  2. /graph-sync — builds knowledge graph for new codebase
  3. Complete visual verification checklist
  4. Populate the profile CONFIG dev file (e.g. connection strings) with real values
  5. {SOURCE_PATH} remains in additionalDirectories until validated

  Cleanup: rm .claude/migration-checkpoint.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

