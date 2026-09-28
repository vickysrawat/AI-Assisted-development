# MEMORY.md — Project memory (dream-managed)

### [2026-09-27] Task completed — Gap 6: sub-step checkpoint granularity

Two SKILL.md edits. (1) Step 1.5: manifest_authored sub-step gate — skip guard before authoring (check-gate → exit 0 skips to intake-verify, exit 3 authors fresh), gate write after manifest written to disk, before intake-verify runs. (2) Step 2.5: 7 design_doc_{type}_written gates — table maps doc→gate, skip guard before each subagent spawn, sequential gate writes after each wave (matches cluster B2 pattern). All 7 gate names: design_doc_component/data/security/integration/infrastructure/deployment/feasibility_written. No new scripts. 63/63 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Task completed — 6 residual gaps fixed

Gap A: options judge prompt extended with 4 coupling quality criteria (coverage, evidence specificity, consumer completeness for facade, factual consistency) with hallucination/incomplete/missing-coverage finding types. Gap B: ## Coupling pattern resolutions section template added to Step 2.5 for component/integration/security docs — DECISION format with alternatives rejected + specific evidence + lifecycle. Gap C: resolution_approach added to technology_couplings[] schema in research spec Section 2; agent skips retain/defer. Gap D: skip guard table updated — 3 docs show "## Coupling pattern resolutions" sentinel, 4 show "## ". Gap E: SP-1.5-1 after manifest_authored (before coupling scan), SP-1.5-2 after coupling_resolution_confirmed (before Step 2), SP-2.5 after each document wave. Gap F: design judge narrowed to consistency check — verifies resolution_approach in design docs matches options-approved decision, not quality re-check. 132/132 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Plan approved — 6 residual gaps fix pass

Gap A: extend options judge prompt with coupling quality criteria (hallucination/incomplete/missing-coverage detection). Gap B: add ## Coupling pattern resolutions template to SKILL.md Step 2.5 for component/integration/security docs. Gap C: add resolution_approach to technology_couplings[] in research spec Section 2. Gap D: fix skip guard table sentinels for 3 docs (## → ## Coupling pattern resolutions). Gap E: Phase 4 safe points for Steps 1.5 (SP-1.5-1 after manifest, SP-1.5-2 after coupling gate) and 2.5 (SP-2.5 after each document wave). Gap F: design judge coupling consistency instruction (check design docs faithfully record options-approved decision, not re-check quality).
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Task completed — Sub-problem 2: cloud component grounding

migration-research-spec.md Section 3: CloudComponentRecommendation bundle entry (type="coupling_replacements", array per pattern with component/use_case/when_to_prefer/tier_guidance/coexistence_note/pattern_name/CitationEntry; resolution_approach drives replace vs facade recommendations; retain/defer skipped). Section 4.1: rendering rules for CloudComponentRecommendation inline (4 cases: replace high/medium, facade, UNKNOWN). Section 7: offline fallback table covering WCF/MSMQ/WindowsAuth/Java EE EJB/HttpContext.Current/Web Forms × Azure/AWS/GCP/stack-agnostic — confidence=medium, spec date. SKILL.md Step 2: extracts coupling_replacements entry from bundle, routes to recommendations or offline fallback, Section 4 rendering for "Coupling addressed" row. 132/132 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Plan approved — Sub-problem 2: cloud component grounding

migration-research-spec.md: Section 3 gains CloudComponentRecommendation bundle entry type (type="coupling_replacements", array of per-pattern recommendation objects with component, use_case, when_to_prefer, tier_guidance, coexistence_note for facade, pattern_name, CitationEntry); Section 4.1 rendering rule for CloudComponentRecommendation; Section 7 offline fallback table (WCF/MSMQ/WindowsAuth/EJB/HttpContext.Current per AWS/Azure/GCP, confidence=medium, spec last-changed date). SKILL.md Step 2: after bundle received, read coupling_replacements entry and use it to populate "Coupling addressed" row per coupling per option. If agent returns UNKNOWN for a coupling → use offline fallback with stale signal.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Task completed — Coupling Resolution Gate + enforcement stack

coupling-resolution-validate.cjs: validates resolution_approach set for critical/major, facade has external_dependencies[] with valid system_name+migration_status, decision_log has coupling entry. 26 tests. architectural-coupling-spec.md: resolution_approach (replace|facade|retain|defer), external_dependencies[], facade_note fields; Section 7 (Coupling Resolution Gate format — ALL approaches shown + rejected + evidence); Section 6 (options_judge_correction payload); Section 8 (updated scan sequence). SKILL.md Step 1.5: gate + script call + coupling_resolution_confirmed gate. SKILL.md Step 2: coupling_resolution_confirmed prerequisite check; options_judge_correction payload write before correction UI; RERUN-COUPLING-GATE + OPTIONS-CORRECT handlers with safe point before each; iteration cap 3. Step 2.5 sentinels: component/integration/security use "## Coupling pattern resolutions"; others keep "## ". migration-ledger-schema.md RESUME: checks options_judge_correction.pending step 2. 132/132 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-28] Plan approved — Coupling Resolution Gate + Sub-problem 2 full scope

Full implementation approved: (1) coupling-resolution-validate.cjs + tests — structural: resolution_approach set for critical/major, facade has external_dependencies[], decision_log has coupling entry; (2) architectural-coupling-spec.md extended: resolution_approach field (replace|facade|retain|defer), external_dependencies[], facade_note, decision-grade gate format with rejected alternatives; (3) SKILL.md Step 1.5 Coupling Resolution Gate: evidence-based proposals with ALL approaches shown + rejected + reason, constraint-gathering (not approach selection), coupling-resolution-validate.cjs call, coupling_resolution_confirmed gate; (4) SKILL.md Step 2: gate check at start, extended options judge prompt (coupling quality criteria), options_judge_correction payload (pending/completed per CP), safe point before each correction item, RERUN-COUPLING-GATE + OPTIONS-CORRECT handlers, iteration cap 3; (5) migration-ledger-schema.md RESUME: checks options_judge_correction.pending; (6) Step 2.5 sentinels: component/integration/security docs use "## Coupling pattern resolutions" sentinel.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Sub-problem 1: source coupling analysis with hard boundary enforcement

8 deliverables complete. New: coupling-boundary-validate.cjs (validates required_cluster_splits vs cluster-spec.json; primary error=UNMAPPED when concern has no matching cluster; VIOLATION when two concern strings normalise to same cluster); 34 tests. architectural-coupling-spec.md: 5 coupling types, CouplingPattern schema with concerns[] field, severity levels, required_cluster_splits derivation rule, 6-step coupling scan sequence. source-context-manifest-template.md gains ## Coupling Patterns table. SKILL.md Step 1.5: coupling scan + payload write (coupling_patterns, required_cluster_splits, technology_couplings); SKILL.md Step 3: cluster naming convention (must use concern vocabulary) + post-decompose validator call; SKILL.md Step 2 options table gains "Coupling addressed" row. migration-research-spec.md Section 2 gains technology_couplings[] input field. 106/106 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Sub-problem 1: source coupling analysis with hard boundary enforcement

8 deliverables approved: coupling-boundary-validate.cjs + tests (hard enforcement script); architectural-coupling-spec.md (5 coupling types, CouplingPattern schema with concerns[] field, severity levels, required_cluster_splits derivation rule); source-context-manifest-template.md gains ## Coupling Patterns section; SKILL.md Step 1.5 adds coupling scan + checkpoint payload write; SKILL.md Step 3 adds cluster naming convention (must use concern vocabulary) + post-decompose validation script call; SKILL.md Step 2 options template gains "Coupling addressed" row; migration-research-spec.md Section 2 gains technology_couplings[] for Sub-problem 2. Naming alignment constraint: cluster names must match concern vocabulary so the validation script can compare.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Item 4: architectural grounding for options generation (scope)

Two sub-problems scoped. Sub-problem 1 (start here): extend Step 1.5 intake to systematically identify architectural coupling patterns (domain, technology, data, deployment, integration coupling) that should be decoupled in the target — applies to both pure rewrite and replatform+rewrite. Sub-problem 2 (after): extend research agent with cloud component grounding (service selection + tier/config guidance) cited from WAF/Architecture Center docs, using CitationEntry schema. Both sub-problems in scope.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Item 3: citation structure for cached research facts

migration-research-spec.md: FactObject replaced with CitationEntry (adds source_type, cloud_provider, authority, applies_to, claim, canonical_url, additional_sources[], conflict_note, reason). Section 4 restructured into 4.1 inline rendering (4 tiers + stale signal + additional_sources + conflict_note), 4.2 source_type validation rules (community max=medium, multi-vendor requires ≥2 sources, cloud expects additional_sources), 4.3 Citations block template. Section 6 gains source_type mapping table. SKILL.md Step 2: 4-line rendering rule replaced with reference to Section 4.1-4.3; options template gains ## Research Citations block. 72/72 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Architecture decision — Item 3: CitationEntry schema with source_type + cloud_provider

Final CitationEntry schema: source_type ("vendor"|"cloud"|"multi-vendor"|"community") drives validation rules; cloud_provider ("aws"|"gcp"|"azure"|null) is specific identifier used when source_type="cloud". additional_sources[] (role: corroborates|supplements|announcement|context) covers fragmented sources (AWS/GCP/Java JDK vendors). conflict_note added for disagreeing sources. Validation: multi-vendor+confidence=high+additional_sources=[] → error; community+confidence=high → auto-downgrade to medium; cloud+additional_sources=[] → warning. Changes: migration-research-spec.md (CitationEntry schema + Section 4 rendering + Section 6 provider table) + SKILL.md Step 2 (inline rendering + Citations block template). No new scripts, 72/72 tests unchanged.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Item 3: citation structure for cached research facts

Three-layer citation design: (1) Bundle schema — each fact carries CitationEntry (fact_type, authority, applies_to, claim, source_url, canonical_url, retrieved_date, confidence, reason). (2) Inline rendering — 4 confidence tiers + stale signal ([⚠ cached Nd ago]) when cache age > 30d. (3) Document-level Citations block (## Research Citations table with cache key + age). Changes: migration-research-spec.md + SKILL.md Step 2 only. No new scripts, 72/72 tests unchanged. If agent returns fact without source_url/authority, treat as confidence=UNKNOWN.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Phase 3: dirty-stop protocol (B+C combined)

New `dirty-stop` CLI op in checkpoint-ledger.cjs: accepts --data-file (avoids shell quoting on arrays), validates 4 required fields (stopped_at, stopped_before, at, reason), writes dirty_stop to payload[skill] atomically, exits 5 on missing checkpoint. 9 new test assertions (payload stored, clusters_completed preserved, missing file no-mutation, invalid JSON, missing fields no-mutation, cleared to null). SKILL.md Step 3 has dirty-stop protocol block with 4-step sequence (data file → dirty-stop CLI → tracker 🔴 → developer message). dirty_stop cleared at SP-4 via set-payload null. migration-ledger-schema.md RESUME step 2 checks dirty_stop: if present shows stopped_at/stopped_before/cluster status, requires CONFIRMED or RESTART WAVE N before continuing. 72/72 tests passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Phase 3: dirty-stop protocol (Option B+C combined)

New `dirty-stop` CLI operation in checkpoint-ledger.cjs (Option B): accepts `--data-file` (avoids shell quoting on arrays), validates required fields (stopped_at, stopped_before, at, reason), writes `payload[skill].dirty_stop` atomically. SKILL.md dirty-stop block calls this command (Option C). 7 new test assertions. `dirty_stop` cleared after SP-4 via set-payload with null. RESUME handler in migration-ledger-schema.md checks dirty_stop before "Run Status" — surfaces summary if present. Cluster names sourced from payload.rewrite.clusters (Gap 5 wiring).
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Phase 2: safe points SP-1 through SP-4 in Step 3

4 safe point blockquotes added to SKILL.md Step 3 (proactive layer). SP-1 after cluster payload writes (before wave 1); SP-2 after B2 checkpoint updates (before Write Gate); SP-3 after Step E fragment appends (before Step F tracker update); SP-4 after wave gate write (before next wave). Each follows same pattern: conditional stop (no mandatory CONTINUE), writes active-task.json with step3-spN identifier, updates tracker, surfaces resume message. 63/63 tests still passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Gap 6: sub-step checkpoint granularity (Option D)

Sub-step gates for Step 1.5 (manifest_authored) and Step 2.5 (design_doc_{type}_written × 7). Step 3 already protected by Gap 2 worktree guard; Step 1/2 acceptable without sub-step gates. Gate written by orchestrator AFTER subagent returns, not inside subagent (sequential writer). Skip guard checks gate before spawning subagent — if PASS, read existing file, skip re-authoring. SKILL.md-only changes; no new scripts; tests remain 63/63.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Gap 5: SKILL.md wiring (artifact gates + payload completeness + RESUME validation)

7 edits to skills/rewrite/SKILL.md: (1) Step 1 adds source_version+target_stack+target_version to payload; (2) intake_context gate gets --artifact-path+--sentinel+--min-bytes; (3) Step 2 stores research_cache_key after cache block; (4) options_approved gate gets artifact metadata + selected_option_label payload; (5) design_approved gate gets artifact metadata; (6) Step 3 stores cluster_count + clusters array (id/name/worktree) after decompose; (7) merge_gate gets artifact metadata. 1 edit to migration-ledger-schema.md: RESUME handler (d) now calls validate-artifacts after status=ok, branches on exit 0/2 with structured recovery message. 63/63 tests passing. Gap 5 fully complete.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Gap 5: artifact-disk consistency + gate schema 1.1 extension

`setGate` now accepts optional `artifactMeta` (artifact_path, sentinel, min_bytes); stores gate as object when metadata provided, flat string otherwise — backward compatible. `check-gate` tolerant reader handles both formats. New `validate-artifacts` CLI op: iterates PASS object-gates, verifies file exists + size >= min_bytes + sentinel present; exit 0=ok, exit 2=invalid (structured JSON listing gate, path, status: missing|empty|truncated). 13 new assertions, 28/28 checkpoint-ledger + 35/35 research-cache = 63 total passing. Payload completeness (Item 2 of Gap 5) captured in SKILL.md set-payload call sites — implement in Phase 3 dirty-stop work.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Gap 5: artifact-disk consistency + checkpoint state completeness

Two combined schema changes approved. (1) Gate object format (schema 1.1 extension): `set-gate` accepts optional `--artifact-path`, `--sentinel`, `--min-bytes`; stores gate as object `{verdict, at, artifact_path, sentinel, min_bytes}` when metadata provided, flat string otherwise — backward compatible. `check-gate` handles both formats (tolerant reader). `validate-artifacts` new op reads checkpoint, iterates PASS object-gates, checks exists + size + sentinel; exit 0=ok, exit 2=one or more invalid. (2) Payload completeness: `set-payload` call sites in SKILL.md updated to capture all resume-critical state (source/target stack+version, research_cache_key, selected_option, cluster names, worktree paths) so REWRITE RESUME reads one file and orients without re-reading generated docs.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Gap 2: worktree idempotency guard in rewrite SKILL.md Step 3

Replaced single `git worktree add` with a 3-case checkpoint-aware guard: Case 1 (cluster_N_merged gate = PASS) skips the cluster entirely, Case 2 (worktree exists, no gate) cleans with `git checkout . && git clean -fd` and reuses, Case 3 creates fresh. Added `cluster_{N}_merged` gate write at Step C after Write Gate APPROVE to make Case 1 fire on future re-runs.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Architecture decision — machine-level research cache + citation structure requirement

Research-agent bundle cache must be machine-level (not project-level) at ~/.claude/migration-research-cache/ so all projects on the machine share stack facts. Cache key: {source_stack}-{source_version}-to-{target_stack}-{target_version}.json. Two-tier TTL: warn at 30 days, hard-expire at 90 days. Because cache is unversioned, every document using a cached fact must embed a complete citation (fact type, vendor/authority, applies-to version, claim, source URL, retrieved date, confidence, reason cited). Citation structure design is Item 3 on the work list — design after Gap 4 so cache structure and citation format are designed together.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Gap 3: migration log fragment double-append gate

Added checkpoint-gated block to Step E in rewrite SKILL.md. Gate (cluster_{N}_fragment_appended) is written BEFORE the append — a detectable omission is safer than an undetectable duplicate. On re-run, if gate is PASS the re-created fragment file is discarded without appending. Pre-append guard also verifies migration-log.md exists before any append.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Task completed — Gap 4: options file pre-write guard + machine-level research cache

Two-part fix for Step 2 idempotency. Part 1: pre-write guard checks options_approved gate before writing the options file — if gate not set and file exists, overwrites from scratch (never reads partial file). Part 2: new scripts/research-cache.cjs + tests/research-cache.test.cjs — machine-level bundle cache at OS cache dir, shared across all projects. Cache key: {source_stack}-{version}-to-{target_stack}-{version}.json. Two-tier TTL: warn 30d, expire 90d. Atomic writes. Corrupt entries self-heal. 35/35 tests pass, 50 total across both scripts.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Error resolved — research-cache.test.cjs fixture/cache dir collision

Two test failures: (1) writeBundleFile used JSON.stringify on the "invalid JSON" string making it valid — fixed by writing raw bytes directly with fs.writeFileSync. (2) expire swept fixture files because they were in the same CACHE_DIR — fixed by adding separate FIXTURES_DIR for bundle input files. Pattern: always write test input fixtures to a dir outside the dir being scanned/tested.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — dirty-stop developer message design

Dirty-stop message shows ✅/⬜ per cluster by NAME (not index), states "will not be repeated on resume" explicitly, offers both /compact and new session paths, shows tracker path for VS Code review. Tracker uses 🔴 (unexpected stop) not 🔄 (in-progress by choice). Cluster names sourced from cluster-spec.json; falls back to "Cluster N" by index if missing. Implement as Phase 2 after all gaps closed.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Architecture decision — context exhaustion: two-layer graceful stop system

Gap fixes (1–6) are idempotency infrastructure prerequisites. After gaps are closed, add: (1) Proactive layer — explicit safe points within Step 3 (after cluster-spec write, after each cluster's B2 payload, after each fragment append, after each wave gate) where the conservative bias rule can stop cleanly. (2) Reactive layer — dirty-stop protocol: write structured dirty_stop payload to checkpoint, update tracker with exact stopped-before state, surface developer message with literal resume command, then STOP. REWRITE RESUME reads dirty_stop and skips completed operations. Four phases: Phase 1 gap audit, Phase 2 safe points in Step 3, Phase 3 dirty-stop protocol + CLAUDE.md resume handler update, Phase 4 extend to Steps 1.5 and 2.5.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Gap 2: worktree idempotency guard in rewrite SKILL.md Step 3

Option B chosen: three-branch checkpoint-aware guard before git worktree add. Case 1 (cluster_N_merged gate = PASS) skips the subagent entirely. Case 2 (worktree exists, no gate) cleans and reuses. Case 3 (no worktree) creates fresh. Also adds cluster_{N}_merged gate write at Step C after Write Gate APPROVE so case 1 fires correctly on any future re-run.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Task completed — Gap 1: checkpoint-ledger.cjs fail-closed on missing file

Added `missingCheckpointMessage()` helper and made `set-gate` / `set-payload` fail with exit 5 when the checkpoint file does not exist, instead of silently creating an empty envelope. Message uses two-scenario split (fresh start vs deleted file) with git recovery steps. 4 new test assertions added. 15/15 passing.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — Gap 1 error message design for checkpoint-ledger.cjs

Error messages for missing-checkpoint failures must: (1) state the concrete consequence first, (2) split into two named scenarios with the scenario label before the action, (3) explain what each command does before showing it, (4) use technical language freely but no plugin-internal jargon ("checkpoint" OK, "gate verdicts/stage_gates/init" not OK). "Do NOT run the command in Scenario A" is the correct reference — not "Do NOT run init". Exit code 5 = checkpoint absent at write time.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Architecture decision — rewrite skill integrity audit over token reduction

Pivoted from splitting skills/rewrite/SKILL.md (1,243 lines) into step files to auditing context exhaustion integrity gaps in the monolithic skill. Token reduction (Option C — extract 2 templates to references/) is parked as a followup. The real ROI is fixing 6 identified mid-step recovery failures: silent checkpoint resurrection, no worktree idempotency, migration log double-append, partial artifact re-encounter, artifact-disk consistency gap, and no sub-step checkpoint granularity. Audit proceeds one gap at a time with full 7-section analysis per item.
Trigger: Architecture decision  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Task completed — governance-gate-precommit.cjs wired and documented

Added governance-gate-precommit.cjs to HOOK_FILES in setup-init-bootstrap.cjs so setup-init deploys it to .claude/hooks/ in target projects. Updated _project-deploy/hooks/README.md to document it as "manual chain" (vs findings-gate-precommit which is "auto-installed"). Git only supports one pre-commit file — findings-gate-precommit owns that slot; governance-gate is chained manually by teams that want both.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-09-27] Task completed — governance-report schema normalisation

Added normalizeEvent() + normalizeEventType() to governance-report.cjs. Maps both audit schemas (audit-write SCREAMING_SNAKE + audit-append dot.notation) to a single canonical shape before any analysis runs. Applied via raw_events.map(normalizeEvent) in loadAuditEvents(). All three field mismatches fixed: event type, actor, ado_id. Removed now-redundant inline e.ts||e.timestamp in modelDistribution.
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-27] Plan approved — governance-report schema normalisation

Fix three HIGH issues in governance-report.cjs: (1) ado field mismatch (ado_id vs ado), (2) actor field mismatch (actor vs os_user/git_email), (3) event type mismatch (APPROVE_ADO vs gate.approve). Approach: add a normalizeEvent() function applied after loadAuditEvents() that maps both audit-write and audit-append schemas to a unified shape before any analysis runs.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

### [2026-09-27] Task completed — audit ADO linkage gap (audit-append.cjs)

Added `resolveActiveAdo()` to `audit-append.cjs` (both plugin and deploy template). It reads `.claude/active-task.json` and auto-populates `ado` on every audit event when a skill is active. Caller-provided `ado` still wins. No changes needed to individual hooks — single-point fix. Also removed `ado` from the generic field loop since it is now handled explicitly before the loop.
Trigger: Task completed  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Architecture decision — ADO linkage in audit events

Rejected per-hook ADO extraction (fragile, each hook would need its own filename parsing). Chose reading `active-task.json` in the shared `appendEvent` helper — skills already write this at every step boundary, so it's always populated during skill execution and empty between skills (correct behaviour in both cases).
Trigger: Architecture decision  Confidence: 0.88  Source: auto-capture

### [2026-09-27] Task completed — audit file accumulation fix (audit-append.cjs)

Changed audit shard key from `YYYY-MM-DD-{PID}` to `YYYY-MM-DD` in both `.claude/hooks/audit-append.cjs` and `_project-deploy/hooks/audit-append.cjs`. Created `.gitattributes` with `merge=union` for `*.jsonl` files. Root cause: each hook fires as a new node process (new PID), so every event created its own file. Fix: date-only shard = one file per day; appendFileSync with O_APPEND is atomic for small writes on NTFS/ext4.
Trigger: Task completed  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Architecture decision — audit shard strategy

Rejected per-PID sharding (unbounded file accumulation) and date+branch sharding (requires git subprocess per event). Chose date-only shard + `.gitattributes merge=union`. Union merge is safe for append-only JSONL because each line is a self-contained record; git auto-combines lines from both branches without a conflict marker.
Trigger: Architecture decision  Confidence: 0.88  Source: auto-capture

### [2026-09-27] Task completed — citation capture at WebFetch call site (migration-research-agent)

Updated `skills/migration-research-agent/SKILL.md` to bind `source_url` immediately at each WebFetch call site in Step 2 (not deferred to Step 3 assembly). Added citation-capture rule preamble to both rewrite/upgrade and replatform Step 2 sections, annotated each substep with `Immediately bind source_url`, reframed Step 3 as "completeness check only", and added a "Citation at fetch site" invariant to Constraints. Prevents URL drift where the recorded URL diverges from the page that produced the fact.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-09-27] Task completed — active-task.json stale state cleared at skill completion (Issue 8)

Added `> Write .claude/active-task.json: {}` at confirmed-completion point in all 5 skills: icea-implement (after confirm block, before Step 6a), icea-feature (after SAVE TECH confirm block, before Step 10a), upgrade (after step_8a checkpoint flush), replatform (after step_r5a checkpoint flush), rewrite (after final Hard Rules line). No hook change needed — hook already exits 0 when skill/step absent. Residual: crash/context-exhaust during a skill leaves the file intact (correct — preserves resume point).
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-27] Task completed — setup-status checks context-guard.cjs (Issue 11)

Added context-guard.cjs to setup-status SKILL.md hook presence list (line 621) and added UserPromptSubmit wired check (mirrors memory-capture pattern). Now projects upgraded without context-guard will surface it as MISSING/NOT_WIRED in setup-status health report.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-09-27] Task completed — wrong hook path fixed + deployment assertions in test (Issue 10)

Fixed context-budget-spec.md Wiring section: `.claude-plugin/hooks/context-guard.cjs` → `.claude/hooks/context-guard.cjs` (source dir vs deployed dir). Extended context-budget-wiring.test.cjs with `── Deployment wiring ──` section: asserts context-guard.cjs in HOOK_FILES, wiring block present in bootstrap, and .claude/settings.json UserPromptSubmit wired. Test now 16 assertions — deployment regressions are self-enforcing.
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-27] Task completed — context-guard.cjs universally deployed (Issue 9)

Added context-guard.cjs to HOOK_FILES in setup-init-bootstrap.cjs + added UserPromptSubmit wiring block (mirrors audit-prompt pattern, always node). Updated console.log summary. Copied to .claude/hooks/ for plugin dev session. Added to .claude/settings.json UserPromptSubmit. Updated context-budget-spec.md wiring section — removed "migration skills detected" condition, now universal. The entire context guard system is now live end-to-end.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### [2026-09-27] Plan approved — context-guard.cjs universal deployment (Issue 9)

Three changes to setup-init-bootstrap.cjs: add context-guard.cjs to HOOK_FILES, add UserPromptSubmit wiring block (mirrors audit-prompt — always node, no shell variant), update console.log summary. ALSO wire in plugin's own .claude/settings.json (not just _project-deploy). Update context-budget-spec.md wiring section — remove "migration skills detected" condition, replace with "deployed universally".
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-27] Plan approved — active-task.json stale state fix (Issue 8)

Each skill writes `{}` to active-task.json at its confirmed-completion point — hook already exits 0 when skill/step fields absent, so no hook change needed. 5 SKILL.md additions: icea-implement Step 6 confirm block, icea-feature Step 10 SAVE TECH completion, rewrite Step 5 completion gate, upgrade Step 8a, replatform Step R5 flush. Test extended to assert clear instruction presence.
Trigger: Plan approved  Confidence: 0.91  Source: auto-capture

### [2026-09-26] Task completed — context-budget-wiring test + icea-implement resume_cmd (Issue 7)

Created tests/context-budget-wiring.test.cjs: validates all declared budget steps have active-task.json writes (both inline JSON and bash node-e formats), non-migration skills include resume_cmd, and context-guard.cjs supports the field. Test immediately caught missing resume_cmd in icea-implement — fixed. Pattern: write the test before declaring "done"; tests enforce what reviews miss.
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-26] Task completed — context-budget-spec.md updated for resume_cmd (Issue 6)

Added resume_cmd optional field to active-task.json schema in context-budget-spec.md. Updated "How to add a new skill" step 2 example to include resume_cmd and added a note: include it when recovery keyword doesn't follow `{SKILL} RESUME ADO-{ID}`, omit for migration skills. Spec now matches implementation — no future maintainer drift.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-09-26] Task completed — icea-feature context budget protection + resume_cmd fix (Issue 5)

Added active-task.json writes to icea-feature/SKILL.md at Step 3 end (step4-draft-icea, resume_cmd=PLAN ADO-{ID}) and Step 8 (step8-draft-tech, resume_cmd=TECH ADO-{ID}). Added icea-feature entries to context-budgets.json (80K/100K). Fixed context-guard.cjs to use `activeTask.resume_cmd` when present — backwards-compatible, one-line change. Pattern: resume_cmd field in active-task.json overrides the generic `{SKILL} RESUME ADO-{ID}` construction for skills with non-standard recovery keywords.
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-26] Plan approved — icea-feature context budget protection + resume_cmd fix (Issue 5)

Three-file fix: (1) context-guard.cjs: add `resume_cmd` optional field — falls back to `{SKILL} RESUME ADO-{ID}` if absent; (2) context-budgets.json: add icea-feature step4-draft-icea=80K, step8-draft-tech=100K; (3) icea-feature/SKILL.md: active-task.json writes at end of Step 3 (before SAVE PLAN prompt) and at Step 8 before inline check. Both deployed copies of context-guard.cjs (.claude/hooks/ and _project-deploy/hooks/) need the fix.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-26] Task completed — icea-implement active-task.json format standardised

icea-implement Step 3d now has both the canonical `> Write .claude/active-task.json: {...}` inline line (matched by tooling/scanning regex) AND the explicit bash `node -e writeFileSync` block. Other skills use inline-only. Future skills should use both when the write is inside a bash code block — the inline line is what the cross-check test scans.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### [2026-09-26] Architecture decision — icea-implement mid-story context exhaustion: rework not corruption

Decided NOT to add per-AC temp writes now (deferred follow-up). Recovery path is: tracker is implicit checkpoint (✅ Done skipped, ⏳ Pending regenerated on re-run) → rework only, never corruption. Documented in Hard Rules: "Mid-story context exhaustion produces REWORK, not corruption." Per-AC temp writes (`temp/ADO-{ID}-AC-{N}.draft.md`) noted as follow-up to reduce rework to one AC.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### [2026-09-26] Task completed — rewrite active-task.json wiring completed (Fix 4)

Added active-task.json writes to rewrite/SKILL.md for steps 1.5, 2, 3, and 5 (steps 1 and 2.5 were already wired). All 6 declared budget entries in context-budgets.json now have matching writes. Context budget protection is now fully wired across all 4 skills: icea-implement (step4-start), rewrite (6 steps), upgrade (step1/3/5), replatform (R1–R5).
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-26] Task completed — upgrade/replatform active-task.json wiring (Fix 3)

Added `active-task.json` write instruction to 3 STEP BUNDARYs in upgrade/SKILL.md (step1, step3, step5) and 5 in replatform/SKILL.md (R1, R2, R3, R4, R5) — matching exactly the keys declared in context-budgets.json. Pattern: one line `> Write .claude/active-task.json: {...}` immediately after the STEP BOUNDARY header, before "The checkpoint is flushed". Hook was already deployed and budgets declared — missing writes were the only gap.
Trigger: Task completed  Confidence: 0.93  Source: auto-capture

### [2026-09-26] Task completed — icea-implement context budget protection (Fix 2)

Added Step 3d to icea-implement/SKILL.md: counts pending ACs from tracker, writes `.claude/active-task.json` (`skill:icea-implement,step:step4-start`), runs inline context-budget-check (threshold_medium=10, threshold_high=20 ACs), shows STEP BOUNDARY prompt before Step 4. Added `icea-implement.step4-start=60000` to context-budgets.json. Pattern: inline check warns early; active-task.json write enables the OS hook on the developer's CONTINUE reply.
Trigger: Task completed  Confidence: 0.92  Source: auto-capture

### [2026-09-26] Plan approved — context budget multi-issue fix (structured review)

Approved structured review of context budget gaps: (1) model_windows set to 200K for 1M-context models — causes premature hook blocks; (2) icea-implement has zero protection (no STEP BUNDARYs, not in budgets.json); (3) upgrade/replatform write active-task.json nowhere — declared budget entries are dead config; (4) rewrite only wires 2 of 6 STEP BUNDARYs. Fix order: model window first, then icea-implement, then upgrade/replatform/rewrite wiring. Option C chosen: inline check at session start + per-story active-task.json writes for icea-implement.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### [2026-09-26] Plan approved — graph cross-repo metadata enforcement (3 layers)

Approved: (1) deterministic script check in graph-sync-deterministic.cjs — emits WARN_UNMATCHED_DEP for any additionalDirectories root missing from the Locally-Cloned table; (2) checkin advisory block surfacing those warnings at commit time; (3) LLM instructions in update-arch, architect Step 7b, and graph-sync Step 4. Script layer is bypass-proof; checkin layer makes it visible at highest friction point; LLM instructions catch it early in happy path.
Trigger: Plan approved  Confidence: 0.88  Source: auto-capture

### [2026-09-26] Task completed — graph cross-repo metadata: 5 files written

graph-sync SKILL.md (Steps 2x-a/2x-d/7a), multi-root-scan.md, graph-json-schema.md, and both architecture-integrations.md templates updated. Pattern: `## Locally-Cloned Dependency Repos` table in architecture-integrations.md is the committed source of direction/tier; graph-sync builds an in-memory `localPathMeta` merge-map from it in Step 2x-a and applies it to sourceRoot nodes in Step 7a instead of creating duplicate stubs.
Trigger: Task completed  Confidence: 0.88  Source: auto-capture

### [2026-09-26] Architecture decision — Graph cross-repo direction/tier metadata source

Use `architecture-integrations.md` (Option C Extended) as the single source of truth for direction/tier metadata of locally-cloned dependency repos in `additionalDirectories`. A new `## Locally-Cloned Dependency Repos` table with a `Local path:` column triggers graph-sync to build an in-memory `localPathMeta` merge-map instead of creating a stub external node; Step 7a applies direction/type from the map to the real `sourceRoot` node before fallback inference. Options A (companion key in settings.local.json — not committed, machine-local) and B (dir-meta.json — new file, new concept) were rejected because architectural classification of upstream/downstream relationships is a team-level decision that belongs in version-controlled architecture docs, not in machine-local config.
Trigger: Architecture decision  Confidence: 0.88  Source: auto-capture

### 2026-09-26 — Task completed — test plan gap fixes implemented (4 gaps, Gap 2 was pre-existing)

Gap 1 (icea-implement): Step 6a now checks audit file for gate.test-plan-skip before hard-blocking; if bypass found, soft warn and continue. Lightweight mode auto-generates test plan after code write using SAVE TEST --subagent (auto-detects --source plan). Gap 3 (hook): .plan.md added to stale marker condition alongside .icea.md and .techspec.md. Gap 4 (test-plan SKILL.md): new Step 9x REFRESH TEST with smart merge — cross-cutting/stub/generated suites regenerated; expanded suites (developer-written) get revision notice block with changed AC list, never overwritten. Gap 5 (icea-revise): stale marker only deleted on confirmed REFRESH TEST success. Gap 2 was already implemented (--source plan existed in skill auto-detect).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Plan approved — test plan lifecycle gap fixes (5 gaps)

Approved plan: (1) audit-file check for skip-test-gate bypass in icea-implement hard gate; (2) --source plan mode added to test-plan skill for lightweight mode — reads Must Have items as AC-F{N}; (3) hook adds .plan.md to stale marker condition; (4) REFRESH TEST smart merge — cross-cutting regenerated, expanded story suites get revision-notice block, stubs regenerated; (5) stale marker only cleared on REFRESH TEST success in icea-revise. 5 files change: hook, test-plan SKILL.md, icea-implement SKILL.md, icea-revise SKILL.md.
Trigger: Plan approved  Confidence: 0.88  Source: auto-capture

### 2026-09-26 — Task completed — test plan lifecycle fixes: stale marker + gates hardened

5 changes: (1) icea-revision-signal.cjs writes test-plan-stale-ADO-{ID}.json to .claude/signals/ whenever ICEA or Tech Spec is revised (hook or chat edit); (2) icea-revise runs REFRESH TEST after writing revised files and deletes the stale marker; (3) icea-approve Step 3a added stale-marker check — hard blocks if stale before existing test-plan-exists check; (4) icea-implement Step 6a changed from warn-and-continue to hard gate when test plan missing; also checks stale marker and auto-refreshes before stub expansion; (5) icea-feature now generates test plan draft into temp/ immediately after Tech Spec draft so developer reviews both together before SAVE TECH — Step 10b just moves the temp file to permanent. Pattern: stale marker file in .claude/signals/ as the mechanism, deleted by icea-revise + icea-implement + SAVE TECH.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Task completed — automated graph freshness: checkin gate (Option 3) + CI flag (Option 1)

New script `scripts/graph-sync-deterministic.cjs`: no-LLM graph refresh — recomputes fingerprints, re-derives EXTRACTED edges via graph-extract-edges.js, syncs external nodes from architecture docs, regenerates graph-index.md, deletes .stale. Exit code 1 = new modules detected (need /graph-sync). Wired into checkin SKILL.md as Step 1c (runs only when .stale exists, zero overhead otherwise). CI option: `ci_graph_sync` flag in dream-init-state.json (default false); `SET GRAPH-SYNC-CI on/off` keyword handlers added to both CLAUDE.md files; seeded in setup-init-bootstrap.cjs. Key pattern: separate deterministic parts (fingerprints, EXTRACTED edges, external nodes — automatable, zero tokens) from LLM parts (new module classification — manual /graph-sync once).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Architecture decision — graph as primary dependency source; arch docs as fallback

Graph extended to represent all cross-system boundaries: external-api, database, message-bus, shared-library, upstream-app, downstream-app, storage, identity-provider. graph-sync populates these from architecture docs (integrations.md→external-api/apps, data.md→database, deployment.md→bus/storage/identity). ICEA reads graph first; skips architecture doc reads when graph has the data (token saving). Architecture docs remain the source-of-truth that populate the graph, not the runtime read source. New edge types: writes, subscribes, publishes, uses, fed-by, feeds. New fields on nodes: external, tech, direction, source.
Trigger: Architecture decision  Confidence: 0.92  Source: auto-capture

### 2026-09-26 — Task completed — icea-feature graph orientation gaps fixed (6 gaps)

Enhanced Codebase Orientation in icea-feature SKILL.md to close 6 graph usage gaps: (1) detail file always read (not lazy); (2a) patterns/dependencies/reverse-edges extracted from detail file; (2b) graph.json queried for hub flag and typed edges with edge-type→AC obligation mapping table; (2c) dependency chain traversed 2 hops for multi-layer features; (7) orientation summary consolidated with patterns/chain/downstream/edge-ACs; Step 1 orientation declaration expanded to 4 lines (ORIENTATION/CHAIN/DOWNSTREAM/EDGE-ACs). schema reference line also updated to include graph-json-schema.md.
Trigger: Task completed  Confidence: 0.88  Source: auto-capture

### 2026-09-26 — Architecture decision — Epic/Story SP threshold raised from 5 to 8

Epic threshold changed from `> 5 SP` to `> 8 SP`; story slice cap changed from `≤ 5 SP` to `≤ 8 SP`. Rationale: AI compresses implementation time so the 5 SP limit created unnecessary friction (extra ICEAs, approve cycles, PRs); 8 SP keeps individual PRs reviewable by humans while giving AI room to implement meaningful features in one pass. 13 SP was considered and rejected — too large for human review. Updated in 4 files: SKILL.md (3 lines), icea-template.md, techspec-base.md, techspec-epic-level.md (2 lines).
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Task completed — output_mode compact/verbose toggle + APPROVE ordering fix

Added output verbosity control to the plugin. Key pattern: `output_mode` field in `dream-init-state.json` (seeded as "verbose"); toggled via `SET OUTPUT verbose/compact` keyword handlers (added to both CLAUDE.md and _project-deploy/CLAUDE.md §0a). Compact mode shows one-line step summaries in chat; verbose details go to `.claude/logs/ADO-{ID}-session-{YYYY-MM-DD}.md` via new `scripts/output-log-write.cjs`. Hard ordering rule added to both CLAUDE.md Output Mode sections and `skills/shared/output-mode-spec.md`: APPROVE prompt is always the last output — diff goes before it, never after. `.claude/logs/` added to GITIGNORE_BASE. Pattern mirrors SET GOVERNANCE lightweight/full exactly.
Trigger: Task completed  Confidence: 0.85  Source: auto-capture

### 2026-09-26 — Task completed — signal-write.cjs optional ADO + hook simplified + icea-implement signal

Three changes shipped: (1) signal-write.cjs --ado-id now optional; emits ado_id:null when absent; filename uses UNKNOWN suffix; (2) icea-revision-signal.cjs simplified — removed all ppid/session-file logic; always captures, passes null ADO when not in filename or branch; (3) icea-implement SKILL.md Step 6 adds signal-write call post-write with ADO always in context. Verified: with-ADO and null-ADO signals both write correctly.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Architecture decision — gap signals don't require ADO ID; ado_id is optional traceability

Key insight: Dream uses signals for PATTERN learning (category tallies → project-knowledge.md), not for ADO attribution. The ado_id is useful context when available but never a gate. Making --ado-id optional in signal-write.cjs removes all complex session-ADO mapping machinery. Hook captures with null ADO when not determinable; skills capture with ADO (always in context). Abandoned: active-ado.json, session-ado.json, ppid-chain walking — all unnecessary once ADO is optional.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Plan approved — branch gate at icea-feature Step 1 (not at Write Gate)

Decision: branch gate fires at icea-feature Step 1 immediately after ADO_ID is collected — before any drafting, not at the Write Gate in icea-implement. Rationale: developer picks up a story → gets a branch immediately → ICEA, tech spec, and code all land on the same branch; multiple parallel stories each get their own branch from day 1; no mid-implementation friction. Branch slug derived from the feature description at Step 1. If AI creates the branch, record in audit trail. Option C (skip) still allowed but logged.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — icea-revision-signal PostToolUse hook implemented

New hook `.claude/hooks/icea-revision-signal.cjs` fires on every Write|Edit PostToolUse event. Matches: ADO docs (icea.md, techspec.md, plan.md, test-plan.md) → revision signal with inferred category; source code on feature/ADO-* branch → scope-changed. Excludes: tracker.md, ai-audit.md, critic files. Wired in settings.json + setup-init-bootstrap.cjs (HOOK_FILES + PostToolUse wiring + deploy-template copy). Path bug fixed: relative `docs/` path vs absolute `/docs/` — check both forms with `fp.startsWith('docs/')`.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — all 3 icea-implement guard rails applied

Three guard rails written to skills/icea-implement/SKILL.md: (1) Step 4b deferred goal-loop criterion test-suite-{N} (percentDone < 100% until expansion confirmed); (2) Step 6a mandatory test suite expansion post-write with status:stub/generated metadata check; (3) Step 4 hard rule block — gap analysis runs for ALL story types, SKILL.md/doc-only are NOT exempt, plus 2 hard rules added to the global Hard Rules section. 3 retrospective gap signals written to .claude/signals/ for ADO-9006 Examples E3/E4/E5.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Error resolved — icea-implement Example gap analysis skipped for SKILL.md-only stories

Step 4 of icea-implement requires checking every ICEA Example to verify it can produce a real assertion. For SKILL.md-only stories I skipped this — rationalised as "no compiled code, no assertions." Wrong: gap categories (return-shape-unspecified, test-data-unspecified, edge-case-missing) apply equally to manual scenario tests. ADO-9006 had 3 gaps (E3: return shape unspecified, E4: test data unspecified, E5: edge case missing) that should have been written to .claude/signals/ via signal-write.cjs. Fix: add explicit hard rule to Step 4 — gap analysis runs for ALL story types, "no compiled code" never skips it.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — icea-implement Step 6a + rubric fix written to SKILL.md

Two insertions applied to skills/icea-implement/SKILL.md: (1) Step 4b goal-loop rubric extended with deferred criterion test-suite-{STORY_N} — percentDone < 100% until Step 6a audit row is written; (2) Step 6a added between Step 6 and Step 7 — reads test-plan-state metadata, runs EXPAND TEST --subagent on status:stub suites, appends audit row. Both changes are in the checked-in SKILL.md (not the installed plugin copy — setup-sync needed to propagate to target projects).
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Architecture decision — icea-implement Step 6a + goal-loop rubric fix

Two-part fix approved: (1) New mandatory Step 6a after Step 6 in icea-implement SKILL.md — reads test-plan-state metadata block, auto-expands the story's suite via EXPAND TEST --subagent, audits the result; (2) goal-loop rubric extended with a "test-suite-{N} status:generated" deferred criterion so percentDone < 100% until Step 6a confirms expansion. The rubric change is the stronger enforcement — it makes the LLM's own goal-loop enforce expansion, not just procedural sequence. Root cause: step was simply absent from SKILL.md, not bypassed by APPROVE ALL.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Error resolved — icea-implement missed test expansion for SKILL.md-only stories

When all stories are SKILL.md-only (no compiled code), icea-implement must still: (1) note manual verification scenarios in the tracker "Tests added" section, and (2) run EXPAND TEST immediately after implementation to expand all stub suites in the test plan. I skipped both — test plan stubs remained as stubs and tracker showed "Verified by design" without concrete TCs. Fix: always expand test plan stubs after IMPLEMENT completes, even for Markdown-only stories. Manual scenario verifications count as tests.
Trigger: Error resolved  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Task completed — ADO-9006 all 5 stories complete

ADO-9006 fully implemented: migration-research-agent/SKILL.md (both modes), migration-research-spec.md, personas-spec.md ([SA] extended), rewrite+upgrade+replatform calling skill modifications. Key patterns: (1) [SA] was EXTENDED not duplicated — new ID would break existing migration skill references; (2) canonical_url vs source_url distinction in UNKNOWN facts — source_url=null when UNKNOWN, canonical_url is "check here" link; (3) agent preamble goes BEFORE options file write (rewrite) / report assembly (upgrade) / step 7 options (replatform) — grounding precedes content; (4) Retire/Retain postures get abbreviated PO sections marked "Not applicable".
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — ADO-9006 Story 1: migration-research-agent SKILL.md written

`skills/migration-research-agent/SKILL.md` created (342 lines). Key patterns: (1) discriminated union on `migration_type` with validation guard at top of execution; (2) sequential WebFetch per-layer (not parallel) to preserve single-invocation bound AC-NF3; (3) UNKNOWN fallback uses `canonical_url` not `source_url` — this distinction lets calling skills render "not found" honestly without implying a URL was actually fetched; (4) CVE exposure is qualitative only (high/medium/low) — never a raw count. GCP /docs/deprecations achieves confidence=high without auth; AWS lifecycle is medium-high by design.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — ADO-9006 SAVE TECH complete, all 13 files in permanent docs/

SAVE TECH ADO-9006 succeeded: epic techspec + 5 story specs + tracker + test plan skeleton + tech critic file all saved to docs/Release1/Sprint1/UserStory9006/. ICEA auto-approved (Status: Approved · EPIC · 16 SP). Temp cleaned. Test plan is Epic skeleton — expand suites per story via EXPAND TEST ADO-9006 Suite-N after each story merges.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Task completed — ADO-9006 epic tech spec package drafted (TECH recovery)

TECH ADO-9006 cross-session recovery produced: epic spec (16 SP, 5 stories), 5 per-story specs, and tracker in temp/. Stack: plugin-only (nodejs + dotnet_framework detected but no overlay matched — base-only used). Sizing: AC-F1/NF=3SP (Story 1), AC-F2=3SP (Story 2), AC-F7+F8=3SP (Story 3), AC-F3+F4+F5=4SP (Story 4), AC-F3+F6=3SP (Story 5). ICEA auto-approved inline. Pattern: for SKILL.md-only plugin stories with no framework overlay, base-only template is appropriate — do not use dotnet_framework overlay when nodejs is also present.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-09-26 — Approach abandoned — BigQuery MCP for GCP lifecycle data

BigQuery public dataset (google_cloud_release_notes) requires a billing-enabled GCP project and bigquery.jobs.create permission even for free queries. Developers on non-GCP migrations have no GCP project — the MCP server fails immediately with a permissions error. Abandoned in favour of WebFetch-only. Never assume BigQuery or any cloud-account-specific MCP for the migration-research-agent.
Trigger: Approach abandoned  Confidence: 0.95  Source: auto-capture

### 2026-09-26 — Architecture decision — migration-research-agent cloud provider scope and confidence matrix

All three cloud providers (Azure, AWS, GCP) are in scope — no exclusions. WebFetch-only (no MCP, no IAM, no cloud account). Confirmed confidence matrix: Azure = high all fact types (centralized lifecycle portal); AWS = high pricing/SLA/compliance + medium-high lifecycle (RSS + service docs pages, no central EoL portal); GCP = high all fact types — lifecycle via cloud.google.com/{product}/docs/deprecations structured markdown tables (Feature | Deprecated date | Shutdown date) + RSS fallback. GCP lifecycle is high not medium because the /docs/deprecations URL pattern gives structured, BigQuery-backed data via WebFetch without any authentication.
Trigger: Architecture decision  Confidence: 0.95  Source: auto-capture

### 2026-09-25 — Plan approved — ADO-9006 migration-research-agent + options PO framework

Plan saved at docs/Release1/Sprint1/UserStory9006/ADO-9006-migration-research-agent.plan.md. Five Must Haves: (1) migration-research-agent/SKILL.md with discriminated union input — rewrite/upgrade mode uses {source_layers[], target_layers[]} for stack lifecycle/CVE/ecosystem research; replatform mode uses {source_environment, target_environment.components[]} for cloud pricing/SLA/compliance research; (2-4) all three migration skills options sections restructured with PO framework; (5) shared migration-research-spec.md + [SA] Solution Architect migration specialist persona added to personas-spec.md. Won't Have: GCP/AWS (Azure only), project-specific TCO, real-time CVE count.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### 2026-09-25 — Plan approved — migration-research-agent design

Agreed: create `migration-research-agent` (same isolation model as bc-searcher — no codebase access, structured JSON output, single responsibility). Scope: grounds all externally observable migration facts — lifecycle (EoL dates, CVE exposure), TCO benchmarks (public cloud pricing + IDC/Gartner ROI studies), ecosystem health (adoption trends, hiring signal, community activity), tooling landscape. Returns one structured bundle per invocation with source URL + retrieved date per fact. Project-internal facts (current infra costs, team size, codebase complexity) stay as flagged placeholders. This agent is the data layer for the migration options phase PO-framework restructure — the two ship together as one ADO. Name chosen over "migration-facts-searcher" to reflect broader scope.
Trigger: Plan approved  Confidence: 0.92  Source: auto-capture

### 2026-09-25 — Architecture decision — PO analysis framework in migration options phase

Agreed: the Options section of rewrite/replatform/upgrade skills should be restructured using the PO analysis framework (what happens if not resolved · tradeoffs · solution options · what we need to do · whether it can remain · how to verify). Rationale: the options phase is the last human gate before significant effort is committed; the current matrix (assurance × effort × TCO) is descriptive but not decision-grade. Priority order: rewrite first (options span genuinely different architectural approaches), replatform second (residual-risk "whether it can remain" is most underserved here), upgrade third (options more constrained). The "state validation / no-silent-repair" principle was scoped to migration family only — NOT icea family — because the icea goal-loop is intentional bounded auto-repair on in-context unwritten content, not silent overwrite of persistent history. These are two separate initiatives.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

### 2026-09-25 — Task completed — Lightweight Governance Mode + Auto-Approve on Save (ADO-9005)

Implemented across 9 files in 3 parallel phases. Key patterns: (1) governance bash snippet is always node -e try/catch reading dream-init-state.json, defaulting to "full" on any error — fail-safe design; (2) Edit tool requires unique old_string — use surrounding context lines to disambiguate similar blocks; (3) for goal-loop Step 0 restructure, replacing "Announce..." paragraph + code fence was sufficient to be unique without capturing entire step; (4) critic/SKILL.md plan mode spec inserted before "## The REVISE loop" using the unique CODE mode output sample as anchor; (5) test-plan auto-detect prepended `plan` check before `icea` in the ordered list inside Step 1 — both edits in one pass; (6) checkin governance gate added as new "Step 1b" section between Step 1 report and Step 2 load-context. `APPROVE ALL ADO-9005` not used — standard per-batch approval with user confirming once.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

### 2026-09-25 — Plan approved — Lightweight Governance Mode + Auto-Approve on Save

Approach: add `governance_mode` key (`"full"|"lightweight"`) to `.claude/dream-init-state.json`. Lightweight path: `goal-loop` → draft plan → `SAVE PLAN` (write + critic/plan mode + auto-stamp ✅ + auto-test-plan) → `IMPLEMENT` → `APPROVE` (Write Gate only) → checkin. Full path change: `SAVE TECH` now auto-approves ICEA inline + auto-generates test plan, eliminating the separate `APPROVE ADO-{ID}` and `SAVE TEST` steps. Enforcement is bash-deterministic (each skill reads `governance_mode` via node -e snippet). Nine files affected: both CLAUDE.md files, icea-feature, goal-loop, critic (new plan mode), icea-approve, icea-implement, test-plan, checkin. Key constraint: default absent = "full" (fail-safe). SET GOVERNANCE keyword handler writes to dream-init-state.json + audit entry.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

### 2026-09-25 — Error resolved — Mermaid HTML inline corruption + garbage content after </html>

Root cause: when inlining mermaid.min.js via a line-by-line filter, lines inside the mermaid library that contained the target string ("mermaid.min.js") were deleted, corrupting the library. A subsequent re-injection left ~2.1MB of orphaned content after `</html>` which contained broken `<script>` tags the browser executed, causing `SyntaxError: Unexpected token ')'`. Fix: (1) replace corrupted script tag by byte-position using `indexOf('<script>')` + `indexOf('</script>')` — never use string matching on minified JS; (2) truncate file at `</html>` using position arithmetic to remove garbage; (3) when removing markup from an HTML file that has large embedded scripts, only operate on `html.substring(0, html.indexOf('</main>'))` — never line-filter the full file. Gotcha: never use line-by-line filtering on HTML files containing inlined minified JS; always operate by structural position.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

### 2026-09-25 — Task completed — /operations runbook for ai-assisted-development plugin

Generated docs/operations/ai-assisted-development-Operational-Runbook.md (+ HTML companion). 72 open ⚠ TODOs — primarily contacts, expiry dates, PAT rotation calendar, ADO org/project placeholders, and data-retention policy. Key operational facts: plugin is developer-local (no server), all state is git-tracked file-based JSON, AZURE_DEVOPS_PAT is the only rotatable secret. Mermaid diagrams degrade to source text (no vendored mermaid.min.js committed).
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

### 2026-09-24 — Task completed — /app-readiness assessment for the plugin itself

App-readiness --full run on the plugin repo (2026-09-24). Verdict: Not Ready. EA-3 (Observability) = 2 Red: no structured logging, scripts emit console.log only. EA-4 (Security) = 2 Red/Blocking: security/ folder absent, no /security-review ever run. EA-1 pipeline YAML is well-structured (CI + ReleaseValidation, npm audit, version consistency) but ADO live state unverified (PAT not set). EA-5 + EA-6 = 4 Green. Report at prod-readiness/app-readiness-2026-09-24.html.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

## 2026-09-24 — Task completed — B2: manifest-read-guard PreToolUse hook

Pattern: when a fix needs to prevent re-reads of a large cached artifact, add a PreToolUse hook on `"Read"` that checks the ledger for the cached summary and blocks/redirects. Extra gate check (gate=PASS but summary absent) gives a diagnostic instead of silent allow — catches the SKILL.md-skipped-set-payload case. Replatform's old `--key=source_context --value=` was also a silent bug caught during this fix; always use `--payload-json` for object-valued fields. Hook armed only AFTER summary written — absent summary is always allow so Step 1.5 authoring is never blocked.
Trigger: Task completed  Confidence: 0.95  Source: auto-capture

## 2026-09-24 — Plan approved — B2: manifest-read-guard hook + source_context.summary

B2 fix approved: Option A + D + mechanical enforcement. New PreToolUse hook `manifest-read-guard.cjs` intercepts `Read` calls to `source-context-manifest.md`; blocks when `source_context.summary.coverage_verdict` is present in the ledger; allows when ledger absent (Step 1.5 authoring in progress) or summary absent. Extra gate: if `stage_gates.intake_context === PASS` but summary absent → block with diagnostic ("summary write was skipped"). Six artifacts: hook (×2 files), settings.json wiring, ledger schema addition, source-context-intake-spec update, three SKILL.md set-payload expansions. Closes the prose-only bypass gap from the initial B2 analysis.
Trigger: Plan approved  Confidence: 0.95  Source: auto-capture

## 2026-09-23 — Error resolved — upgrade-checkpoint test fails after setup-init creates .claude/graph/graph.json

Root cause: `setup-init` ran on the plugin dev repo and created `.claude/graph/graph.json` with 8 plugin modules. `opVerify()` defaults to `CWD/.claude/graph/graph.json` — so the A1 guard's re-validation picked up the plugin's own knowledge graph, fired exit 7 (module-unaccounted), and blocked the SET-GATE test. Fix: (1) A1 guard in `upgrade-checkpoint.cjs` now reads `source_context.graph_path` from the ledger and passes it as `--graph` to check-gate — uses the explicitly stored graph, not the default CWD path; (2) test creates an empty `{ nodes: [] }` graph in temp dir and stores its path in `source_context.graph_path`. Gotcha: if setup-init is run on the plugin dev dir, any test relying on the default CWD graph path will pick up the plugin's own 8-module graph — always store and pass graph_path explicitly.
Trigger: Error resolved  Confidence: 0.95  Source: auto-capture

## 2026-09-23 — Plan approved — B9: cluster results via --payload-file, not shell JSON string

Approved: add `--payload-file=<path>` to checkpoint-ledger.cjs set-payload op (reads JSON from file, merges as patch — no shell interpolation). Subagent writes checkpoint payload to `.claude/migration/{ADO}/clusters/{N}/cluster-N-payload.json` via bash; returns short display fields (verdict, paths, bal_grade) as text. Orchestrator Step B2 uses `--payload-file` instead of `--payload-json='{...}'`. Eliminates all four failure modes: shell quoting, arg-length limits, LLM truncation, and LLM reformatting.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Task completed — B3 spec preflight in rewrite/SKILL.md Step 2.5

Added bash preflight block (step "0") before graph-derive-documents.cjs that checks 6 required spec files exist and hard-stops with a clear message if any are missing. Enforcement-level (bash not prose). B8 updated with B3↔B1 connection: per-document spec routing (which spec each agent gets) belongs in B8's cluster execution contract schema.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Plan approved — B3 spec preflight: bash existence check before Step 2.5 subagents spawn

Approved: add bash preflight block at Step 2.5 start (before graph-derive-documents.cjs) checking all required spec files exist. Enforcement-level (bash, not prose) — fixes stated issue completely. The B3↔B1 connection (same spec files loaded redundantly by each of 7 agents = token amplification) is a separate concern that belongs in B8's per-document spec routing scope. B3 fix is Option A only: existence check, no routing changes.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Approach abandoned — B1 demand-model and prose-based inventory partitioning

Any SKILL.md instruction to the LLM ("read only your domain slice", "don't load the full inventory") is prose advice, not enforcement — the LLM can bypass it. The demand model (pass file path, agent reads on demand) does NOT fix per-agent token load: the agent still reads the full file to filter. Pre-computed slices + text injection is the best achievable without enforcement infrastructure. The ONLY reliable fixes are: (1) inject slice TEXT (not path) so the agent has no route to the full file, or (2) a `PreToolUse` hook that blocks reads to the full inventory from non-integration subagents. B1 is deferred as ICEA-level requiring hook enforcement. B5 context guard mitigates the worst case by blocking Step 2.5 entry on insufficient headroom.
Trigger: Approach abandoned  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Architecture decision — LLM instructions are bypassable; enforcement requires hooks or structural access control

Learned through B1 analysis: any instruction to an LLM to "read less" or "stop early" is prose advice that can be ignored — same failure mode as the hardcoded token thresholds B5 replaced. Reliable enforcement at the plugin level requires either: (1) structural access control (don't give the agent the path to content it shouldn't load), (2) content injection of pre-computed slices (inject TEXT not PATH — agent has no reference to find more), or (3) PreToolUse hook blocking specific file reads from specific subagent contexts. This principle applies to B1 (inventory loading), B3 (spec file loading), and any future "please read less" instruction in a skill.
Trigger: Architecture decision  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Task completed — setup-init run on plugin's own dev repo

setup-init completed on the AI-Assisted-development plugin repo itself. Repo type detected: PYTHON_FASTAPI (false positive — actual stack is Node.js/.cjs). Bootstrap completed with OneDrive atomic rename workaround (EPERM on rename → use writeFileSync + unlinkSync instead of fs.rename). Architecture files populated for Node.js plugin (not FastAPI templates literally). Domain: generic, jurisdiction: US. Knowledge graph: 8 modules (scripts, skills, tests, docs, _project-deploy, guides, tools, contest). 1 EXTRACTED edge: tests→scripts. Rules deployed: 15 files. Key gotcha: .tmp rename fails on OneDrive-synced paths — must work around with copy+delete pattern.

## 2026-09-23 — Task completed — B5: context guard hook infrastructure

`_project-deploy/hooks/context-guard.cjs` (UserPromptSubmit, stdin→payload, stderr+exit 2 to block), `.claude-plugin/context-budgets.json` (per-skill/per-step headroom + model windows), `skills/shared/context-budget-spec.md` (protocol doc). Skills participate by writing `.claude/active-task.json` at each STEP BOUNDARY — skill-agnostic, zero hook changes needed for new skills. Rewrite/SKILL.md: Step 1 context check fixed (25–40K, no 80K threshold); Step 2.5 clarified (10–20K main session + 56–105K in isolated subagents). Token counting gotcha: must sum `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` — `input_tokens` alone is near-zero under heavy caching. For 1M context, set `model_windows["claude-sonnet-4-6"]: 1000000` in context-budgets.json.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Task completed — Transcript usage block format verified

Claude Code JSONL transcript: every assistant entry has `message.usage` with `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`. Current context = sum of all three input fields — `input_tokens` alone is near zero with heavy caching (e.g., 3 + 741 + 262495 = 263K). Model ID is in `message.model` as `"claude-sonnet-4-6"` without the `[1m]` suffix — window size must be explicit in config, not inferred from model ID alone. Hook reads the last assistant entry by scanning lines in reverse.
Trigger: Task completed  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Plan approved — Hook-based context guard: transcript measurement + per-skill declared needs

Approved design: `UserPromptSubmit` hook reads last assistant `usage` block from transcript, computes `remaining = window - (input + cache_creation + cache_read)`, reads `.claude/active-task.json` for current `{skill, step}`, looks up declared headroom in `.claude-plugin/context-budgets.json`, blocks with a /compact instruction if `remaining < declared`. Hook is skill-agnostic — any skill participates by writing `active-task.json` at STEP BOUNDARYs and declaring needs in `context-budgets.json`. Window size is explicitly configured per model ID.
Trigger: Plan approved  Confidence: 0.90  Source: auto-capture

## 2026-09-23 — Architecture decision — Hook-based context management replaces hardcoded prose thresholds

Hardcoded token thresholds in SKILL.md prose (e.g. "stop if < 80K remaining") are model-specific, contradict each other across sections, and rely on AI compliance — all three failure modes. Decision: replace with a `UserPromptSubmit` hook that measures real context usage from the transcript JSONL (last assistant entry's `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`), compares against a per-skill/per-step declared headroom in a plugin config file (`.claude-plugin/skills-budget.json`), and blocks the message if remaining < declared need. The hook reads the active ADO/skill/step from a state file written by the STEP BOUNDARY flush. `PreCompact` saves checkpoint state; `SessionStart` re-injects it after compaction. Self-attestation (asking AI "do you have enough context?") was explicitly rejected — models can't reliably detect what they've forgotten.
Trigger: Architecture decision  Confidence: 0.85  Source: auto-capture

## 2026-09-17 — Goal-loop (icea-implement Step 4b) completion = intent + approved scope of change

**Decision + rationale.** The completeness gate scored code against the **ICEA ACs only** — so
code that passed every AC but left a Tech-Spec-planned file/change unbuilt read as "done". "Done"
must depend on both **intent** (ICEA ACs) and the **approved scope of change** (the Tech Spec's
planned deliverables).

**Fix.** Step 4b's `rubric` is now one ordered list combining: intent criteria (ICEA ACs, type
`functional`/`non-functional`) + approved-scope criteria (Tech Spec AC Coverage Matrix / Files
Changed rows, type `structural`, id = the file/row ref). The rubric schema already had a
`structural` type — that's the natural home for planned-deliverable criteria; no schema/enum change
needed. Not circular: the **code** is the artefact; the specs only supply criteria (the "never run
the loop on the ICEA/Tech Spec" rule still holds). **Precedence: ICEA authoritative** — a structural
criterion that is scope creep vs the ICEA is not a completion target; the Step 4a critic (shared
iteration) flags it as a traceability REVISE. The loop never forces building scope the ICEA never asked for.

**Files touched.** icea-implement/SKILL.md Step 4b (intro + rubric input + precedence note),
goal-loop-spec.md (rubric input row), rubric-score-schema.md (id/text/type rows). Docs/spec-only.

## 2026-09-17 — CODE-mode critic now loads ICEA + Tech Spec (three-way traceability, ICEA authoritative)

**Decision + rationale.** The internal code gate (icea-implement Step 4a → critic CODE mode)
previously graded generated code against the **ICEA only** ([critic/SKILL.md](../skills/critic/SKILL.md)
line 83 read "generated code + the approved ICEA"). But Step 4 generation is told to "Follow the Tech
Spec exactly" — so the generator obeyed the plan while the critic graded only the intent. Gap: code
that satisfied the ICEA but drifted from the Tech Spec's planned design (AC→File matrix, chosen
approach, test derivation) was invisible to the critic. The sharp orphan/traceability checks lived only
in TECH mode, which runs before code exists.

**Fix.** CODE mode now reads a **three-way oracle: ICEA (intent) → Tech Spec (plan) → code**. Both
specs are located in icea-implement Step 2 and passed to the critic; Category C unchanged (both are
docs/, not source). **Precedence: ICEA is authoritative and wins on conflict; the Tech Spec is the
plan.** If code satisfies the ICEA but the Tech Spec itself contradicts the ICEA, the critic does NOT
rewrite code around the bad plan — it surfaces and routes to `REVISE ADO-{ID}` (same escalation TECH
mode uses). The CODE revise loop still regenerates **code**, not the Tech Spec.

**Files touched.** critic/SKILL.md (code-reads table rows for internal+standalone, CODE-mode dimension
renamed "Traceability (ICEA + Tech Spec)" + precedence blockquote, standalone scope-report),
icea-implement/SKILL.md Step 4a, guides/plugin-user-guide.html (critic table row + explanatory note).
Docs/spec-only change — no plugin code path altered.

## 2026-09-17 — Two new consolidated guides authored (user + maintainer); old 3 kept pending review

**Decision.** The 3 guides (`user-guide.html`, `plugin-guide.html`, `developer-guide.html`) duplicated
content. Target = **2 audience-split docs**: `guides/plugin-user-guide.html` (plugin USER) and
`guides/plugin-developer-guide.html` (plugin MAINTAINER). This pass was **additive** — both new files
created; the **old three left untouched** (retire after the user reviews the new two).

**Build technique that worked.** Both new docs reuse the plugin-guide's look & feel by a Node builder
(temp in `c:/tmp`, deleted after) that extracts the `<style>` block and the trailing scroll-spy
`<script>` from `plugin-guide.html` verbatim and injects an authored sidebar + `<main>`. Reusing the
CSS this way guarantees byte-identical offline styling (system fonts, zero CDN) without retyping 356
CSS lines. Body content was authored inline in the builder (template literals — avoid `$` + brace
sequences and backticks in content). Both stamped `<!-- documents-plugin-version: 3.25.0 -->` so the
version guard globs them.

**Content split.** User guide = 10 workflow sidebar groups, all 46 commands in the grouped catalog,
ICEA loop + critic + quality/PR/migrate/readiness/codebase/Dream/keywords/model-routing; NO maintainer
topics. Maintainer guide = orientation/why + component model (commands/skills/rules/shared/hooks/2
subagents bc-searcher+bc-synthesizer) + extending (new-command.sh/new-skill.sh) + gates & governance +
validators/tests + graph internals + release (bump-version → CHANGELOG → docs/migrations →
check-version-consistency); links to the user guide instead of re-documenting commands.

**Verified.** Offline-safe (0 external refs both), 46/46 commands in the user catalog, all nav anchors
resolve (18 / 16), tag balance OK, cited ADR paths exist, audience separation clean (only intended
cross-links), `check-version-consistency.js` green. Follow-up not yet done: retire/redirect the old 3
guides once the new two are reviewed.

## 2026-09-17 — Guides (user/plugin/developer) refreshed: current-state only, commands grouped by workflow phase

**Convention confirmed for the three `guides/*.html`.** (1) They describe what the plugin does
**now** — no "which version added X" history. The "What's new since 3.0.0" sections and all per-item
`New vX.Y` / `(v1.26.0)` badges were removed; each guide now carries a single link to CHANGELOG.md.
(2) Commands are presented in **10 workflow-phase groups** (Setup & session · Feature workflow (ICEA)
· Quality & security · Pull requests · Migration · Readiness & operations · Codebase understanding ·
Memory (Dream) · Metrics & analysis · Docs & writing), alphabetical within each group — not by
release era and not one flat list. All **46** commands appear in the user-guide cards and the
plugin-guide catalog (developer-guide stays workflow + keywords + extending, by design).

**Staleness fixed.** Purged the retired `migration` / `migration-status` skill everywhere →
`upgrade` / `rewrite` / `replatform` (+ `knowledge-freshness`); fixed stub counts 41/43 → **46**
(canonical: 46 commands · 48 skills · 43 rules · 47 shared · 2 agents from plugin.json); added the
two commands the guides never listed (`articulate-as-human`, `knowledge-freshness`) plus `graph-viz`
and the PR commands; fixed the user-guide's broken sidebar (two `#commands-ref` readiness links →
dropped the dead "Readiness" nav group, added the missing `#knowledge-graph` link).

**Technique note.** For the plugin-guide's 220-line command catalog and its 45 scattered version
badges, a throwaway Node generator + a regex stripper (`>New<` or inner text matching `v\d`, keeping
semantic badges like Global/Mandatory/Project) was far safer than dozens of manual edits — but a Node
write invalidates the Edit tool's cached read-state, so re-Read before the next Edit. Guides are docs
(outside the Write Gate). Verified: 46/46 commands both catalogs, all nav anchors resolve, tag
balance OK, `check-version-consistency.js` green.

## 2026-09-17 — Convention: describe supported stacks by FAMILY + range, never pinned minor versions

**Decision.** Human-facing marketing copy (guide hero chips/badges, README intro) must name stack
**families with a coarse range**, not a single pinned minor. Root cause of recurring drift: pins like
`.NET 8` / `Angular 17+` both go stale AND understate reality — the plugin supports a wide matrix
(`_project-deploy/rules/`: csharp-framework48, ado-net-legacy, ef6, vsto, wcf, angular, react/next/
nuxt/astro, java, python, node; detector `scripts/stack-signals.cjs`: dotnet-framework, dotnet-modern,
wcf, …) with **version-aware per-project detection**. There is NO machine-readable supported-stacks
list; the nearest human source of truth is the **CLAUDE.md header** "Supported backends/frontends"
line — align all copies to it.

**Applied.** README:3, user-guide hero chips (472), plugin-guide badges (382) → `.NET (Framework 4.x
→ .NET 10)`, `Angular`, `React`, `Java/Spring Boot`, `Python`, `Node.js`. Added the missing **React**
chip/badge to both guides (hero sentence already promised Angular/React; chips didn't list React).
Left legitimate contextual mentions alone: README:88 ("bump to .NET 8" upgrade trigger example) and
user-guide 3.19.0 changelog line (historically accurate). Developer-guide had no stack pins. User
declined a lint guard — keep family-level via review.

## 2026-09-17 — Migration architecture docs refreshed for the source-context intake gate + exit-range drift

**Root cause of staleness.** `docs/architecture/{upgrade,rewrite,replatform,legacy-migration,migration-glossary}.md`
were written 2026-09-14; the 2026-09-16 refactor (commit `9532c9f`, ADR 0062) added the fail-closed
**source-context intake gate** (`scripts/intake-verify.cjs` + `source-context-intake-spec.md` +
Source Context Manifest) and ledger `source.roots`/`source_context` — none of which the docs
captured. The docs' only use of "intake" was the R1/Step-1 *stage* name, never the new *gate*.

**Gate mechanics (verified, for future doc/skill work).** `intake-verify.cjs verify` exits
**0/2–9** (9 = cross-cutting scan missing/empty/uncited); `check-gate` re-validates from the ledger
(0/10/11) so a hand-set gate isn't trusted. Per-skill fail-closed chain point: rewrite = Step 1.5,
`rewrite-decompose.cjs decompose` calls check-gate first; replatform = R1, `replatform-plan.cjs plan`
calls it first; upgrade = Step 3, the **report gate** is the keystone (`upgrade-checkpoint.cjs
set-gate --gate=report` refuses unless PASS — upgrade has no options stage to guard).

**Convention confirmed.** These 5 files are prose+Mermaid *explainers* (not the skill source) and
carry a consistent extended metaphor — rewrite = building a house, replatform = relocating a
business, upgrade = a medical visit. Match that voice when editing. `legacy-migration-skill.md`
documents the RETIRED monolithic skill (schema 1.10) — the intake gate does not apply retroactively;
leave it. There is **no Mermaid linter** in the repo (diagrams render on GitHub) — verify diagram
edits manually (node ids declared before use, balanced `{}`/`[]`, intact flow direction).

**Drift also found + fixed in source.** All three SKILL.md files understated the verify range as
`2–8`; corrected to `2–9` (rewrite:133, replatform:103, upgrade:161) through the Write Gate. ADR
0062 filename is `0062-migration-mode-on-ledger.md` (not `...-source-target-mode.md`). Verified:
`node tests/validate.js` → 324/0; `node tests/intake-verify.test.cjs` → 17/0; all newly cited paths
resolve.

## 2026-09-16 — Plugin version single-source model + which docs are tracked vs. intentionally untracked

**Convention confirmed.** `.claude-plugin/plugin.json` "version" is the SINGLE SOURCE OF TRUTH.
Version references fall into three tiers: (1) **hard-enforced derived copies** — CLAUDE.md
`# Plugin version:` label and CHANGELOG `[X.Y.Z]` entry (auto-propagated by
`scripts/bump-version.js`; `marketplace.json` must carry NO version); (2) **warn-only narrative
docs** — `guides/*.html` `documents-plugin-version:` stamps + inline `vX.Y.Z` markers, and (now)
the `README.md` `**Version X.Y.Z**` prose header; (3) **intentionally untracked** —
`WHITEPAPER.md` is a point-in-time essay and is deliberately NOT flagged by the guard (user
directive). `scripts/check-version-consistency.js` is the drift guard; `bump-version.js` wraps it.

**Recurring cause of drift.** `bump-version.js` only auto-writes tier 1 — guides + README only get
a *reminder*, so they silently lag each release. Fix when re-stamping guides: also add the new
`[X.Y.Z]` row to each guide's "What's new since 3.0.0" `<ul>` (developer-guide.html has NO such
list — stamp-only). Re-stamping alone is dishonest per the guard's own "update content AND stamp".

**Action (3.24.0→3.25.0 catch-up).** Re-stamped all 3 guides + README to 3.25.0 (added 3.25.0
multi-root-scanner changelog rows to user- & plugin-guide), and hardened the guard + bump script
to warn on README drift (whitepaper excluded per user). Verified: `check-version-consistency.js`
exits 0 clean; README regex confirmed to fire on simulated drift.

## 2026-09-16 — Retired legacy `skills/command-stubs/`; deployable stubs live only in `_project-deploy/commands/`

**Convention confirmed.** There are three parallel stub sets and they are NOT interchangeable:
top-level `commands/` = the plugin's OWN dev-session slash commands (rich: model routing,
`$PLUGIN_DIR` resolution, full task steps); `_project-deploy/commands/` = the CANONICAL
deployable stubs shipped into target projects (quoted `description` + `Example:`, `argument-hint`,
`--help` verbatim block, fully-qualified `<skill>ai-assisted-development:X</skill>`);
`skills/command-stubs/` = LEGACY, thin old-format (`<command>X</command>` / bare `<skill>X</skill>`),
superseded per DEVELOPER-GUIDE.md:44 and docs/migrations/017-3.7.0.md:12.

**Action.** Deleted `skills/command-stubs/` entirely (34 tracked files). Verified safe first:
description-diff showed every legacy stub was a strict *subset* of its deploy counterpart (nothing
to back-port), and no `scripts/`/hooks/config reference the folder (only changelog/tracker mentions).
The ONE legacy-exclusive file, `articulate-as-human.md` (added today to the wrong folder), was ported
to `_project-deploy/commands/articulate-as-human.md` in deploy format BEFORE deleting.

**Reusable heuristic.** When a new command stub is added, it goes in `_project-deploy/commands/`
(deploy format) — never `skills/command-stubs/`. Before deleting a "legacy" folder, diff its files
against the successor to prove it's a subset, and grep scripts/hooks/config for live references.

## 2026-09-16 — Replatform R5 wired to the NFR oracle (docs-vs-code drift closed) — IMPLEMENTED

**Lesson — a shipped engine can be silently disowned by its own skill's prose.** The same
LLM-as-judge fact-check pass found that `skills/replatform/SKILL.md` Step R5 still read
**"Deferred to Inc C (AC-F8)"** even though the AC-F8 machinery had *already shipped and was tested*:
`scripts/replatform-nfr-assess.cjs` (assess weakest-link + gate regulated-hard-block exit 16, **9/0**),
`references/nfr-assurance.md`, `references/well-architected.md`, and the `payload.replatform.NFR` ledger
field. The engine was cross-referenced by both reference docs, the architecture doc, the tracker, AND the
tech spec (AC-F8 "✅ Covered") — **everywhere except the skill's own stage flow.** The tracker even said
"Story 3 COMPLETE / AC-F8 delivered" while the skill's headline "prove-done" oracle was never invoked.

**Reusable heuristic:** "AC ✅ Covered" at the artifact level ≠ wired. When auditing, check that the
skill's **stage flow actually invokes** the script an AC claims — a passing unit test on a script proves
the engine, not that any skill calls it. This is the mirror of the earlier intake-gate lesson (a rule
gets skipped when nothing downstream depends on it) — here, an engine gets stranded when the stage flow
that should call it still says "deferred."

**Fix (D2 — wire it; skill + governance docs, NO new code):** R5 now invokes the existing tested engines:
per-NFR `replatform-nfr-assess assess`→`gate` (regulated-below-floor HARD BLOCK exit 16; `ceiling_flagged`
must be stated, never reported as fully measured) + Well-Architected assembly (reuse `app-readiness` ERL +
NFR pillars, no re-grade, no double-count) + golden-master pre→post smoke (execution-profile verify
subset) + two-gate "done" recorded to `payload.replatform.NFR` with per-gate judge verdicts. Removed the
`← Inc C` stage-flow marker + the "even while R5 is Inc C" caveat; added a Hard Rule. **No new script —
pure orchestration over already-tested engines, symmetric to Rewrite Step 4/5 calling `rewrite-bal`.**
R5 necessarily runs *after* the human-executed R4 cutover (the target must be deployed) — that's a runtime
dependency, not a missing capability.

**Decisions rejected:** flipping the tech spec's reviewer checkbox (that's a human PR-time action — used a
dated Revision Log entry instead); rebuilding any grader (the engine + WAF-assembly spec already existed);
docs-truth-up only (D1 — rejected: it would document the oracle as unwired rather than turn it on, when
turning it on cost only orchestration prose).

**Status:** IMPLEMENTED (scope: skill/scripts + governance docs, per developer). Shipped: `SKILL.md` R5
rewrite (invokes assess/gate/WAF/golden-master/two-gate/ledger) + stage-flow/caveat cleanup + new Hard
Rule; tech-spec Revision Log 2026-09-16; tracker fix-forward note; contest `06-migration-family.md` §6
updated (oracle now runs, honest "no real-move numbers yet"). Engine/refs/tests UNCHANGED. validate.js
green; replatform-nfr-assess 9/0.

---

## 2026-09-16 — Rewrite decomposition: per-option target-space DAG (drift fixed) — IMPLEMENTED

**Architecture decision — differentiation lives in the INPUT graph, not a flag; the script stays a
pure topo-sorter.** An LLM-as-judge fact-check of the migration-family contest entry, followed by a
code trace, found two spec-vs-code drifts in `scripts/rewrite-decompose.cjs`:
1. **"Target-space decomposition" was actually source-space** — `decompose` only ever topo-sorted the
   source `graph.json`. No target-space graph is produced anywhere (`graph-derive-documents.cjs` builds
   only a *document-authoring* DAG, not a target component graph).
2. **`--option=<A|B|C>` was a silent no-op** — `SKILL.md` Step 2 told you to run decompose "per option"
   with `--option`, but `opDecompose()` never read it. Every option got an identical DAG; the only real
   axis of variation was `--group-by-domain`.

**Root cause (single, reusable lesson):** `decompose` is a *generic topo-sorter* fed one input (the
source graph) identically for every option. "Target-space" and "per-option" are properties of the
**input graph**, not of the sorter or a flag. The user's key insight: at the options phase there is
**no target application yet**, so reusing the source graph for every option is wrong — it's neither
target-space nor differentiated.

**Locked design (skill/scripts scope only — tech spec + tracker left as historical, per developer):**
- The per-option DAG is an **LLM design act fed to a pure sorter**: for each candidate option, project
  the source graph through *that option's* posture (a `port` ≈ source seams; `re-architecture`
  merges/splits/re-layers) and feed it via `--modules/--edges` or a small per-option graph file.
  Different option ⇒ different projection ⇒ genuinely different DAG.
- **`port` is the ONE honest source≈target case** (same lang+fw) where reusing the source graph is
  legitimate; `re-architecture`/`rewrite-from-spec` require a reshaped projection.
- **Provenance labeled:** DAG basis is `INFERRED` at options time (no target app exists), re-derived and
  promoted to `computed` after `APPROVE DESIGN` from the authored `target-component-architecture.md`
  (new SKILL Step 2.5 step 5).
- Script gained only a `--space=source|target` **provenance** flag (echoed into output, default
  `source` for back-compat); `readGraph()`/`topoWaves()` reused unchanged — their generality was the
  whole point. **No `--option` flag added** (it was the wrong mechanism).

**Decisions rejected:** wiring `--option` as a real flag (differentiation belongs in the input, not a
flag); making the script itself do target-space transformation (that's LLM design judgment, must stay
behind the gates); downscoping the docs to "source-space" (the user correctly wanted the capability made
*real*, not the claim shrunk); emitting a concrete `git worktree add` runbook from decompose (rejected —
worktree lifecycle is a gated, verdict-dependent generation loop, not a static runbook, and decompose
has no target-folder knowledge).

**Status:** IMPLEMENTED (plan-mode approved, skill/scripts scope). Shipped: `--space` flag + header
rewrite in `rewrite-decompose.cjs`; `SKILL.md` Step 2 (per-option projection, `--option` removed),
Step 2.5 step 5 (re-derive committed DAG), description/stage-flow/Step 3 + 2 new Hard Rules;
`references/options-and-tco.md` (DAG-shape row + posture→projection table + rule); 5 new tests in
`tests/rewrite-decompose.test.cjs` (16/16 pass, incl. different-input→different-DAG and `--option`-is-a-no-op).
validate.js 300/0. Contest entry `06-migration-family.md` refreshed (claim now backed, not hedged).
**Gotcha:** in bash, `--edges=a>b` triggers shell redirection — quote it (`"--edges=a>b"`); tests are
unaffected because they use `spawnSync` (no shell).

---

## 2026-09-15 — Source-Context Intake Gate (migration family) — DESIGN LOCKED

**Architecture decision — make intake reads unskippable via a fail-closed shared gate.**
A migration run produced gappy design docs because intake made decisions BEFORE reading the
source's own CLAUDE.md, architecture docs, and `additionalDirectories` (Tier 2 deps). Root cause
(the reusable lesson): **a rule gets skipped when nothing downstream depends on it having been
done** — `integration-verification-spec.md` already said "Tier 2 REQUIRED" and it was still
skipped. Prose hard rules are necessary but insufficient.

**Locked design** (design of record: `docs/plans/migrationSkill/source-context-intake-gate.md`):
- Shared substrate across all 3 skills (upgrade · rewrite · replatform), not rewrite-only.
- Turn "reading" into a verifiable **Source Context Manifest** with resolvable `PROV: path#line`
  citations (no citation / dangling citation = not read).
- New `scripts/intake-verify.cjs` (pure/read-only like `strategy-resolve.cjs`): `verify` (exits
  0/2/3/4/5/6) + `check-gate`. Reuses `scanRoots()` from `multi-root-scan.md` — never re-improvise
  root logic.
- **Keystone = ledger chaining:** downstream step refuses without `stage_gates.intake_context=PASS`.
  rewrite → `rewrite-decompose decompose`; replatform → `replatform-plan plan`; upgrade (asymmetric,
  no downstream script — report is LLM-authored) → `upgrade-checkpoint set-gate --gate=report` refuses.
- Ledger fields are **core** (shared, additive): `stage_gates.intake_context` + `core.source_context`.
- Unwired-dependency detection = **script heuristic + judge** (deps named in source docs but not in
  `additionalDirectories` → exit 6). Per-skill manifest depth (upgrade lighter, rewrite deepest).
- **Source-coverage dimension (D7, full accounting — all three skills):** the deepest root cause is
  that migration skills are architected to AVOID reading full source (token economy — they lean on
  `graph.json` + targeted reads), so they translate a *description* of the code, not the code.
  Fix: manifest gains a Source Coverage section; `intake-verify.cjs` reads `graph.json` as the
  denominator (degrade to file enumeration if absent) — every module must be `mapped` or
  `out-of-scope` (exit 7 on a silent drop), and behavior-bearing units must cite an actual **source**
  `file#line`, not a doc (exit 8). `check-gate` re-validates `mapped+out_of_scope==total`. Rejected:
  risk-weighted / per-skill coverage (both reopen the silent-drop gap). Ledger `core.source_context`
  now carries `modules_total/mapped/out_of_scope`.

**Decisions rejected:** prose-only enforcement; rewrite-only scope; gating upgrade at the baseline
tag (too late); judge-only unwired detection; per-skill payload ledger placement.

**Status:** IMPLEMENTED (skip-ICEA path, behind Write Gate, ADO-9000). Shipped: new spec
`source-context-intake-spec.md`; new `scripts/intake-verify.cjs` (verify/check-gate) + `tests/intake-verify.test.cjs`
(9/9 pass); ledger schema core fields; wiring in all 3 SKILL.md (rewrite Step1.5+Step2, upgrade
Step3+report-gate, replatform R1+R2) + integration-verification-spec cross-link. validate.js 300/0.
CI auto-runs the test via `azure-pipelines.yml` glob `tests/*.test.cjs` (no manifest to update).
**Gotcha (script bug caught in test design):** the first citation extractor matched ANY filename-like
token in prose → false-positive dangling-citation on real manifests. Fix: only treat `path#anchor`
tokens (with an explicit #line/#section) as PROV citations. Lesson: an over-broad citation regex
punishes legitimate prose — require the anchor.
**Gotcha confirmed again:** post-code-gen oracle runbook + comparison script belong to
`golden-master-spec.md`, NOT this intake gate — kept out of scope deliberately.

---

## 2026-09-14 — Decoupling audit + fixes (stack-neutral / company-agnostic)

**Architecture decision — coupling lives in *emitted templates*, not skill logic.**
A 3-iteration LLM-as-judge audit found the plugin's skill *headers/logic* were already
stack-neutral, but the **templates skills emit** still hardcoded `.NET/Angular/Node.js`
(the real leak). Pattern to remember: when auditing for stack/company coupling, check the
reference/template bodies a skill outputs — not just the SKILL.md prose.

**What worked / conventions confirmed:**
- Fixed Data Access Convention in `CLAUDE.md` + `_project-deploy/CLAUDE.md` to be
  stack-conditional (per-stack bullets), not an unconditional "Always use Dapper / never EF Core".
- Stack-context fallback in `icea-feature`, `critic`, `pr-describe` now says "No stack is
  assumed" → resolve via `architecture.md` → `.claude/dream-init-state.json`
  (`repo_type`/`detected_stacks[]`) → ask the developer. Never assume a default stack.
- Emitted templates (`ado-tasks/references/task-formats.md`,
  `icea-feature/references/ado-description-template.md`,
  `pr-describe/references/pr-description-template.md` + its SKILL checklist) now derive layers
  from the active stack ("one line/section per active layer"), with .NET/Angular shown only as
  labelled examples.
- Marketplace `owner.name` was the dev's personal name in source and a team name hardcoded
  in install.sh/.ps1/.cjs. Now: source uses "Your Company"
  placeholder; installers write `$COMPANY`; `sync-config.sh`/`.cjs` propagate `owner.name = cfg.company`.
- No company/personal identity literals remain in shipping content (docs/ case-studies are exempt/expected).
  The `validate.js` identity guard derives its denylist at runtime (git identity + `IDENTITY_DENYLIST`)
  rather than hardcoding any name, so the guard itself carries no literal.

**Gotcha:** `Grep` tool times out (~20s) on the OneDrive-synced repo path, especially with
parallel calls. Use per-file scoped greps, `Read`, or delegate to Explore agents that manage
their own search budget.

**Regression guard added** — `tests/validate.js` › "Decoupling guards" section:
(a) denylist scan for company/personal identity in shipping content;
(b) Data Access Convention must be stack-conditional;
(c) the 3 skills must say "No stack is assumed";
(d) the 3 emitted templates must be layer-driven (contain "active layer", no `.NET API:` / `EF Core Entity:` / `.NET: FluentValidation` / `Angular: OnPush`).
Validator: 309 passed / 0 failed after changes.

---

## 2026-09-14 — ADR 0062: migration family de-coupled from checkpoint-schema.md

**Decision (ADR 0062):** The Upgrade/Rewrite/Replatform family now owns its source/target
"mode" on its OWN ledger (`migration-ledger-schema.md`), not on `checkpoint-schema.md`.
Root cause: when the monolithic `migration` skill was retired (ADR 0061), two blocks describing
its old `.claude/migration-checkpoint.json` were left behind in `checkpoint-schema.md` (the
scan-resume checkpoint owned by code-review/security): the `mode` block (schema_version 1.11)
and the `goalLoop` block. Neither had a live writer in the family.

**Field reconciliation (proven before editing):** `mode.source_token/source_version/target_version`
already duplicated ledger CORE `source.{stack,from,to}`; `source_roots` was the ONLY field with no
ledger home; `graph`/`track`/`target_token` and the entire `goalLoop` block were dead (referenced
nowhere live).

**Change set:** (1) added additive optional `source.roots` to ledger CORE; (2) repointed
`tests/validate.js` multi-root assertion from checkpoint-schema → migration-ledger-schema
(`source.roots`); (3) realigned `feasibility-spec.md` + `migration-source-detect.cjs` comment to
`source.*` vocabulary; (4) realigned `goal-loop-spec.md` cross-drop guidance/R3 to parent-owned
checkpoint/ledger; (5) deleted both orphaned blocks from `checkpoint-schema.md`; catalogued ADR
0060/0061/0062 rows in `docs/adr/README.md`.

**Gotcha (critical):** `validate.js:209` HARD-asserted `checkpoint-schema.md` contains `source_roots`
— deleting the block WITHOUT repointing that assertion would have failed the build. Always grep
tests/validate.js for a string before deleting the doc that carries it. Verified: deleting the block
makes checkpoint-schema lack `source_roots` (old assertion would fail), ledger now carries it (new
passes).

**Gotcha:** `validate.js` `ok()` is silent unless `VERBOSE` — per-assertion passes don't print; only
the final count and `bad()` failures show. Don't grep its stdout for a passing assertion label.

**Verification:** validate.js 309/0; migration-retirement 8/0; migration-specs 4/0; substrate-drift
6/0; graph-multiroot 4/0. Zero dangling refs to migration-checkpoint.json/goalLoop/mode.* remain in
skills/shared.

**Note:** No mechanical Write Gate in the plugin's OWN dev session — the enforcement hooks
(script-review-gate.cjs, findings-gate-precommit.*, context-budget-tech-write.cjs) live in
`_project-deploy/hooks/` and only deploy to TARGET projects. The `APPROVE ADO-{ID}` gate here is a
CLAUDE.md prompt convention, not hook-enforced.

---

## 2026-09-15 — ADR 0063: bundled-substrate manifest truth + real-artifact test (steps 1-2)

**Decision (ADR 0063):** `plugin.json → components.shared` is the SINGLE manifest of record for shared
specs; docs must stop hand-duplicating derivable facts. Terminology: "vendored" → "bundled" (keep the
noun "substrate"; reserve "vendored" for genuine third-party libs like graph-viz's mermaid/WebGL).

**Drift found (evidence README is NOT source of truth):** spec count claimed 41 (README) / 42
(DEVELOPER-GUIDE) / 45 (plugin.json) vs 46 on disk — four numbers, none matched. `multi-root-scan.md`
shipped on disk but was UNREGISTERED in components.shared.

**Applied (steps 1-2):** (1) registered `multi-root-scan` in plugin.json (now 46); (2) added a
`validate.js` guard asserting components.shared (as .md set) == `skills/shared/*.md` on disk minus
README, BOTH directions — CI now fails on manifest≠disk; (3) added a REAL-substrate test to
`substrate-drift.test.cjs`: vendors the actual skills/shared, asserts file_count==disk + drift-check
clean (the pre-existing synthetic cases only tested the drift ALGORITHM, not the real artifact).

**Deferred to a follow-up pass (steps 3-4):** the "vendored"→"bundled" rename across scripts/docs/ADRs,
and rebuilding README as current-state-only with the spec-list section GENERATED from plugin.json
(don't retype the drift-prone structure — make it un-driftable, preserve hand-prose like ADO-PAT
degraded mode + "rules for adding").

**Gotcha:** in `validate.js`, `p` (the parsed plugin.json) is BLOCK-scoped to section 1 — re-read via
`readJson('.claude-plugin/plugin.json')` when adding checks in later sections. `fs`/`path`/`ROOT` are
module-level.

**Note (source-of-truth hierarchy, learned this session):** trust executable code > plugin.json
manifest (verified vs disk) > tests > prose docs LAST. README/DEVELOPER-GUIDE/CHANGELOG are projections
that drift; do not cite them as authoritative.

**Verification:** validate.js 311/0; all 23 tests/*.test.cjs green (substrate-drift now 9/0 incl. 3 REAL
assertions).

---

## 2026-09-15 — ADR 0063 steps 3-4: "bundled" terminology + generated/rebuilt README

**Step 3 (terminology):** renamed the misleading verb "vendored/vendoring" → "bundled/bundling" for the
first-party substrate SEAM across `scripts/vendor-substrate.cjs`, `scripts/substrate-drift-check.cjs`,
`tests/substrate-drift.test.cjs`, and `migration-ledger-schema.md`. Per the agreed MINIMAL scope, KEPT
the filenames (`vendor-substrate.cjs`), the `.vendor/` default dir, and `substrate_version` key as
retained identifiers (flagged in README for an optional deeper rename). Genuine third-party "vendored"
usages (graph-viz's 3d-force-graph lib, stack-signals/module-derive dir pruning) were left untouched.

**Gotcha (lockstep):** the drift REASON strings (`'bundled copy edited'`, `'canonical changed since
bundling'`) are asserted by `substrate-drift.test.cjs` — rename script + test together or the test fails.
Also renamed manifest key `vendored_at`→`bundled_at` (no reader, safe). The banner still starts with
`<!-- GENERATED — DO NOT EDIT` so `stripBanner` + the banner-marked assertion still pass.

**Step 4 (README rebuild):** recreated `skills/shared/README.md` as CURRENT-STATE-ONLY (history →
CHANGELOG/ADRs). New `scripts/gen-shared-index.cjs` GENERATES the "Shared specs" table from
`plugin.json` → components.shared + each spec's H1, between `<!-- BEGIN/END GENERATED: shared-specs -->`
markers (modes: default print / --write inject / --check CI guard). Removed the orphaned migration
consumer rows + "Migration:" narrative + the unimplemented "prefer vendored at runtime" claim (replaced
with an accurate "seam is packaging-time only, not consumed at runtime" note). Preserved hand-prose
(ADO-PAT degraded mode, rules for adding). Also fixed the same drift class in `DEVELOPER-GUIDE.md`
(hardcoded "42 specs" count; the now-doubly-wrong checkpoint-schema="Migration checkpoint 1.11"
description; personas "used by migration" claim).

**New CI guards in validate.js (ADR 0063):** (a) components.shared == disk both directions;
(b) `gen-shared-index.cjs --check` (README table not stale). Removed the redundant hardcoded `SHARED`
existence array (superseded by the manifest==disk guard) — this is why validate.js count went 311→300.

**Verification:** validate.js 300/0; all 23 tests/*.test.cjs green (substrate-drift 9/0 post-rename);
gen --check clean. Only genuine 3rd-party "vendored" mentions remain.

---

## 2026-09-15 — Goal-loop/rubric-score: removed orphaned `migration` refs (investigated adopt-vs-remove)

**Question investigated:** should the migration family (upgrade/rewrite/replatform) ADOPT the shared
goal-loop engine (goal-loop-spec + rubric-score-schema), or are the `migration (Stage 4)` refs pure
orphans? Two Explore passes → **adopting would be a category mismatch; remove the refs.**

**Why the goal-loop does NOT fit the family (decision record):**
- goal-loop measures functional COMPLETENESS: score an in-context artefact vs a verbatim rubric
  (percentDone + blocking), regenerate until 100% or a hard ceiling. That's icea-implement's domain
  (code vs ACs). Real consumers today: only `goal-loop` skill + `icea-implement` Step 4b.
- Family uses DIFFERENT completion models: rewrite = judge verdicts (PASS/REVISE/BLOCK) at design/impl
  gates + BAL (mechanical assurance MEASUREMENT, one-shot) + ERL + two-gate; upgrade = deterministic
  tool + one-shot verify + judge gates; replatform = NFR measurability ceilings + human reconciliation
  gate + judge gates. Bounded-revise is already served by the judge ladder (judge.md) — verdict-based,
  not rubric-score-based. Retargeting refs to the family would fabricate a non-existent consumer
  (the prose-vs-code drift ADR 0063 fights).

**Applied (Remove):** stripped `migration (Stage 4)` / `Shared by: migration` + generalized the
migration-specific body examples in `goal-loop-spec.md`, `rubric-score-schema.md`, and
`model-routing-spec.md:42`. Consumers now read `goal-loop` + `icea-implement` only.

**Gotcha:** rubric-score-schema had capital-`M` "Migration:" lines (L35, L37) a lowercase grep MISSED —
always re-grep case-insensitively before declaring an orphan sweep complete.

**Verification:** validate.js 300/0; gen-shared-index --check clean. Only correct family refs remain
(goal-loop-spec L177 "migration-family skill"; model-routing §CRITIC_MODEL_MAX "migration family").

**Flagged (out of scope):** rewrite's design/impl judge REVISE loops are "(bounded)" but the ceiling is
unquantified (unlike design-revision-spec's 5 / goal-loop's 3) — candidate future hardening.

## 2026-09-16 — ADO-9000: hardened intake-verify.cjs cross-cutting scan enforcement (exit 9)

**Audit finding (fix #4 of the rewrite-intake gap set):** the cross-cutting concern scan was
NOT mechanically enforced. `intake-verify.cjs` had zero "cross-cutting" logic — an EMPTY scan
section passed `verify` silently (exit 8 only flags *existing* behaviour rows cited to docs; it
can't detect an absent/blank scan). The judge was assigned the check by
`source-context-intake-spec.md:54` but `judge.md`'s rewrite rubric list omits the intake gate and
NO rubric artifact backs it → the check was a naked, unrubriced LLM instruction. This is exactly
how errorHandler/eventTracer/conversationTracer infra behaviors slipped through the failed rewrite.

**Applied:** added exit code 9 to `verify` — cross-cutting section must be PRESENT; deep-scan skills
(rewrite/replatform) require ≥1 table row AND ≥1 resolvable **source** (non-doc) citation; upgrade is
lenient (delta-only: blank section must carry an explicit none/no-delta/N/A marker or it's a stub).
Reasons: `cross-cutting-missing|empty|uncited|stub`. Mirrored a re-validation into `check-gate`
(keystone — a hand-set `intake_context=PASS` still can't bypass it), reading `sc.skill` from the ledger.

**Convention confirmed:** intake-verify keys on markdown TABLE rows (`tableRows()` parses only
`|`-delimited lines) — free-form prose in a manifest section is invisible to the script. Any new
manifest section that must be enforced has to be authored as a keyword-tagged table with `file#line`
PROV citations. Happy-path test fixture (`goodManifest`) must include every enforced section or the
new check breaks the existing exit-0 test.

**Verification:** `node tests/intake-verify.test.cjs` → 14 passed · 0 failed (5 new: missing/empty/
doc-only → 9, upgrade none-note → 0, check-gate keystone → 11).

**Still open (NOT fixed here — judge's job):** completeness (were ALL real concerns found?) is not
verifiable mechanically. Follow-ups: broaden exit-8 behaviour keyword set to include infra terms
(logging/auth/tracing/error-handling/interceptor/middleware/filter); author a real intake-gate judge
rubric enumerating concern classes + a "source has package X ⇒ scan must address X" mapping; ship a
Source Context Manifest template so authored manifests are parseable.

## 2026-09-16 — ADO-9000: intake cross-cutting hardening follow-ups 1–3 (completeness layer)

Landed the three follow-ups flagged after the exit-9 fix:
1. **Broadened exit-8 keywords** (`intake-verify.cjs`) to include infra concern terms
   (logging·auth·authentication·authorization·authn·authz·tracing·telemetry·error-handling·
   exception·interceptor·middleware·aspect·cross-cutting·caching·resilience·retry·validation).
   An infra row cited to a doc now trips exit 8, same as `business-logic` did.
2. **Authored a real intake-gate judge rubric** — added a "Shared (all three)" bullet to `judge.md`'s
   per-skill list + a "## Judge rubric — intake gate" section in `source-context-intake-spec.md` with a
   concern-class → detection-signal table (source has X ⇒ scan must address X). Security concern
   present-but-unaddressed → BLOCK; other missing concern → REVISE. Calls out WCF `<behaviors>`
   (errorHandler/eventTracer/conversationTracer) as the classic blind spot from the failed run.
3. **Shipped `source-context-manifest-template.md`** (specs/) — pre-seeded concern rows + verifier-shaped
   tables; referenced from the spec's artifact section and rewrite SKILL.md Step 1.5 §3.

**Gotcha (ordering):** exit 8 runs BEFORE exit 9. Broadening exit-8 keywords meant the old
`doccc` fixture (logging→arch.md#L1) started tripping exit 8 not 9 — had to switch that fixture to
prose-only rows (no #anchor → citations()=[] → exit-8 skipped → exit-9 uncited owns it) and add a
separate infra-8 test. Layering rule: exit 8 = a behaviour row WITH citations that are all docs;
exit 9-uncited = a cross-cutting section with rows but NO resolvable source citation at all.

**Verification:** `node tests/intake-verify.test.cjs` → 15 passed · 0 failed;
`node scripts/gen-shared-index.cjs --check` → clean. specs/* is evergreen in freshness-manifest
(no registration needed for the new template).

**Division of labor now explicit:** script proves the scan EXISTS + is source-cited (mechanical,
exits 8/9); judge proves it is COMPLETE (semantic, rubric-driven). The script cannot know what
concerns a given source *should* have — that's the rubric's job.

## 2026-09-16 — ADO-9000: cross-cutting made first-class (per-row grounding, exit 9)

**Bug found by user after the follow-ups landed:** exit-9's grounding check was SECTION-WIDE
(`ccSourceCites.length` over the whole cross-cutting section). One properly source-cited row vouched
for the entire section, so a doc-cited or uncited concern whose name was OUTSIDE the exit-8 keyword
list rode along masked → missed. Keyword-dependence was exactly what we were trying to escape.

**Fix:** rewrote the exit-9 deep-scan check to be PER-ROW. Added `tableDataRows()` helper (excludes
markdown separators AND the header row of each contiguous table block — robust to tables with OR
without a `|---|` separator; first non-sep pipe-row of a block = header). Every concern data row must
now carry ≥1 resolvable SOURCE (non-doc) citation; any ungrounded row → exit 9 `cross-cutting-uncited`
(lists offending rows). Independent of the exit-8 keyword list — a concern with any name is caught.
check-gate keystone switched to `tableDataRows` too (header-only no longer masks as "has rows").

**Layering now (final):** exit 8 = a behaviour row WITH citations that are all docs (keyword-gated,
manifest-wide); exit 9 = cross-cutting section missing / no data rows / ANY data row not source-grounded
(per-row, keyword-independent). Belt-and-suspenders: a doc-cited cross-cutting row is caught by exit 8
if its name matches a keyword, else by exit 9 per-row — it cannot be missed either way.

**Gotcha (header detection):** `tableRows()` keeps header rows; a header has no citation so per-row
grounding would false-positive on it. `tableDataRows()` drops headers. Fixtures/templates here omit
the `|---|` separator, so header detection is POSITIONAL (first pipe-row of a contiguous block),
NOT separator-based — a separator-based rule silently failed on the no-separator goodManifest.

**Verification:** `node tests/intake-verify.test.cjs` → 17 passed · 0 failed. Decisive new tests:
`maskcc` (source-cited + doc-cited sibling, feature-flags name not in keyword set → exit 9, was exit 0
before) and `headcc` (header-only table → exit 9 empty). gen-shared-index --check clean.
