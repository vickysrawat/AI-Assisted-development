# Implementation Plan — Multi-Agent Code Review (Workflow Orchestrator)

## Context

The existing `skills/code-review/SKILL.md` is a single-agent, three-pass sequential scan. It works for small codebases but exhausts context window on 300+ file repos with no error or guidance. The area-scoped single-agent approach was rejected because it misses cross-module vulnerabilities — taint flows that span module boundaries are invisible to a single-context scan. The decision is to rewrite code-review as a multi-agent Workflow orchestrator per the architecture spec at `docs/plans/multi-agent-code-review-with-graph.md`.

**What changes:**
- `skills/code-review/SKILL.md` — Major rewrite: thin entry point, prerequisite check, Workflow invocation
- NEW: `skills/code-review/runners/workflow/code-review.workflow.js` — Self-contained Workflow script (all orchestration, schemas, prompt builders, dedup logic)
- NEW: `skills/code-review/test/fixtures/` — Synthetic vulnerable files for integration testing
- UPDATED: `tests/skill-scenarios/code-review.yaml` — Test scenarios for new architecture
- UPDATED: `.claude/graph/quality/code-review.md` — Graph detail file reflects new architecture

**What does NOT change:**
- `skills/code-review/references/` — All checker references, persona definitions, output format specs (agents still read these)
- `plugin.json` — skill name `code-review` unchanged
- `skills/shared/ledger-schema.md`, `skills/shared/fingerprint-spec.md` — Shared specs still valid
- `CodeReviews/code-review-ledger.md` — Final ledger stays Markdown for backward compatibility (findings-gate-precommit.sh depends on it)

---

## Existing State (Baseline)

```
skills/code-review/
  SKILL.md                         ← single-agent, 3-pass sequential (v2.0)
  references/
    analysis-rules.md
    checkers.md
    checkers-dotnet.md / -java / -python / -typescript
    output-format.md
    pass2-personas.md
    webconfig-checks.md
```

No `shared/`, `runners/`, or `test/` directories exist. No `package.json`. Plugin is pure Markdown + Node.js CJS scripts (no build step, no Jest). Tests: `node tests/validate.js` (259 structural checks, no LLM, **primary gate**); `python3 tests/validate.py` (equivalent, requires Python — skip if unavailable); `node tests/runner.js` (live LLM tests, only when `ANTHROPIC_API_KEY` is set).

---

## Implementation Order (Sequential Dependencies)

1. **Create directory skeleton** — `runners/workflow/`, `test/fixtures/`, `shared/`
2. **Write `code-review.workflow.js`** — self-contained Workflow script (can be syntax-checked independently with `node --check`)
3. **Write fixture files** — needed for integration testing before the skill is used on a real codebase
4. **Rewrite `SKILL.md`** — references the runner path, so runner must exist first
5. **Create `shared/` spec docs** — Markdown specs that document the logic embedded in the workflow script (reference for future LangGraph implementation)
6. **Update `.claude/graph/quality/code-review.md`** — graph detail file
7. **Add `tests/skill-scenarios/code-review.yaml`** — validate.js requires this
8. **Create `scripts/validate-bash.sh`** — bash-only structural gate for environments without Python/Node
9. **Add workflow runner check to `tests/validate.js`** — verify `runners/workflow/code-review.workflow.js` exists
10. **Run validation gate** — `node tests/validate.js` (primary); `bash scripts/validate-bash.sh` fallback
11. **Add CHANGELOG + migration doc** — breaking change, requires v3.13.0 entry

---

## Step 1 — Directory Skeleton

```bash
mkdir -p "skills/code-review/runners/workflow"
mkdir -p "skills/code-review/test/fixtures"
mkdir -p "skills/code-review/shared/prompts"
mkdir -p "skills/code-review/shared/specs"
```

---

## Step 2 — Workflow Runner Script

**File:** `skills/code-review/runners/workflow/code-review.workflow.js`

This is the most complex file (~700-900 lines). It is self-contained — no `require()` of local files. All schemas, prompt builders, dedup logic, and merge rules are defined inline. The script structure:

### Section A — Meta (required by Workflow tool)
```javascript
export const meta = {
  name: 'code-review',
  description: 'Multi-agent SAST code review with parallel module analysis',
  phases: [
    { title: 'Scope',   detail: 'Read graph, build module list' },
    { title: 'Pass 1',  detail: 'Parallel per-module analysis (Haiku)' },
    { title: 'Tracer',  detail: 'Taint path confirmation (Haiku)' },
    { title: 'Pass 2',  detail: 'Persona validation (Sonnet)' },
    { title: 'Pass 3',  detail: 'Adversarial analysis (Sonnet, conditional)' },
    { title: 'Report',  detail: 'HTML assembly + ledger merge (Sonnet)' },
  ],
}
```

### Section B — Schemas (inline JSON Schema objects)

**FINDINGS_SCHEMA** (returned by module agents and adversarial agent):
```javascript
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings', 'suspected_taint'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fingerprint','checker','category','severity','confidence','file','function','line','moduleId','evidence'],
        properties: {
          fingerprint:  { type: 'string', pattern: '^FP-[a-f0-9]+$' },
          checker:      { type: 'string' },
          category:     { type: 'string', enum: ['security','reliability','concurrency','api_contract'] },
          severity:     { type: 'string', enum: ['Critical','High','Medium','Low'] },
          confidence:   { type: 'number', minimum: 0, maximum: 1 },
          file:         { type: 'string' },
          function:     { type: 'string' },
          line:         { type: 'integer' },
          moduleId:     { type: 'string' },
          callers:      { type: 'array', items: { type: 'string' } },
          description:  { type: 'string' },
          evidence:     { type: 'string' },
          remediation:  { type: 'string' },
          pass:         { type: 'integer', enum: [1, 2, 3] },
          dataFlow: {
            type: 'object',
            properties: {
              entry:           { type: 'string' },
              sink:            { type: 'string' },
              traceIncomplete: { type: 'boolean' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['module', 'confirmed'],
                  properties: {
                    module:    { type: 'string' },
                    confirmed: { type: 'boolean' }
                  }
                }
              }
            }
          },
          personaReviewStatus: { type: 'object' },
        }
      }
    },
    suspected_taint: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fingerprint','entry_file','entry_function','call_chain','suspected_sink'],
        properties: {
          // Entry-side fingerprint ONLY: sha1(entry_file + entry_function + "CROSS:" + suspected_sink)
          // Module agent cannot compute sink fingerprint (hasn't read the sink file).
          // Tracer references this exact key to match the suspect record.
          fingerprint:     { type: 'string', pattern: '^FP-[a-f0-9]+$' },
          entry_file:      { type: 'string' },
          entry_function:  { type: 'string' },
          entry_param:     { type: 'string' },
          call_chain:      { type: 'array', items: { type: 'string' } },
          suspected_sink:  { type: 'string', enum: ['sql','html','cmd','file'] },
          confidence:      { type: 'number', default: 0.3 },
        }
      }
    }
  }
}

const TRACER_SCHEMA = {
  type: 'object',
  required: ['action', 'fingerprint'],
  properties: {
    action:       { type: 'string', enum: ['upgrade', 'ruled-out'] },
    fingerprint:  { type: 'string' },   // entry-side fingerprint from suspected_taint record
    confidence:   { type: 'number' },
    // 'upgrade' only — sink location needed to create the confirmed finding:
    sinkFile:     { type: 'string' },
    sinkFunction: { type: 'string' },
    sinkLine:     { type: 'integer' },
    sinkModule:   { type: 'string' },
    checker:      { type: 'string' },
    severity:     { type: 'string', enum: ['Critical','High','Medium','Low'] },
    dataFlow: {
      type: 'object',
      properties: {
        entry:           { type: 'string' },
        sink:            { type: 'string' },
        traceIncomplete: { type: 'boolean' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['module', 'confirmed'],
            properties: {
              module:    { type: 'string' },
              confirmed: { type: 'boolean' }
            }
          }
        }
      }
    },
  }
}

const PERSONA_SCHEMA = {
  type: 'object',
  required: ['actions'],
  properties: {
    decision: { type: 'string' },     // "not-applicable" for P2 skip
    actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'fingerprint'],
        properties: {
          type:          { type: 'string', enum: ['validate','challenge','reduce-confidence','new-finding'] },
          fingerprint:   { type: 'string' },
          newConfidence: { type: 'number' },
          reason:        { type: 'string' },
          finding:       { type: 'object' },    // only for type: "new-finding"
        }
      }
    }
  }
}

const SCOPE_SCHEMA = {
  type: 'object',
  required: ['modules'],
  properties: {
    modules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['moduleId','sourceRoot','files','detailFile'],
        properties: {
          moduleId:    { type: 'string' },
          sourceRoot:  { type: 'string' },
          files:       { type: 'array', items: { type: 'string' } },
          detailFile:  { type: 'string' },
          dependencies: {
            type: 'array',
            items: {
              type: 'object',
              required: ['moduleId', 'detailFile'],
              properties: {
                moduleId:   { type: 'string' },
                detailFile: { type: 'string' }
              }
            }
          },
          hasSecurityNeighbor: { type: 'boolean' },
          // N16: per-module content hash — threaded into buildPass1Prompt as cache-buster.
          // When source files change, hash changes, prompt text changes, cache misses automatically.
          contentHash:         { type: 'string' },
        }
      }
    },
    securityCriticalModules: { type: 'array', items: { type: 'string' } },
    archSecurityContent:     { type: 'string' },
    // Scope agent parses Markdown ledger table into JSON — eliminates parseLedgerMarkdown() complexity
    existingLedger: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fingerprint', 'status', 'firstSeen'],
        properties: {
          fingerprint:  { type: 'string' },
          status:       { type: 'string', enum: ['active','fixed','false-positive'] },
          firstSeen:    { type: 'string' },
          lastSeen:     { type: 'string' },
          severity:     { type: 'string' },
          file:         { type: 'string' },
          checker:      { type: 'string' },
          moduleId:     { type: 'string' },
          passHistory:  { type: 'array' }
        }
      }
    },
    changedNotInGraph:       { type: 'boolean' },
  }
}
```

### Section C — Pure JavaScript Utility Functions

**Fingerprint (pure JS SHA1 — no `require()` needed):**
Implement a self-contained SHA1 in JavaScript (~120 lines). This ensures fingerprints match across orchestrators (Workflow and future LangGraph Python runner both use SHA1).

Intra-module fingerprint key: `sha1(file + ":" + function + ":" + line.toString() + ":" + checker)` → `"FP-" + first_8_hex_chars_of_sha1`

Cross-module suspected_taint fingerprint key (entry-side only — module agent cannot know the sink location):
`sha1(entry_file + ":" + entry_function + ":CROSS:" + suspected_sink_type)` → `"FP-" + first_8_hex_chars_of_sha1`

**Critical invariant:** Fingerprint is stable from module agent → tracer → ledger. Module agent computes entry-side fp, stores in suspected_taint[]. Tracer receives the suspect, traces the path, returns `fingerprint: <same entry-side-fp>`. Orchestrator creates a NEW confirmed finding using that fingerprint, populating `file/function/line` from `sinkFile/sinkFunction/sinkLine`. The `dataFlow.sink` records the confirmed sink location. `mergeRuleB` is NOT used for tracer upgrades — the orchestration body handles it directly.

**Merge Rule A (Pass 1 agent merge — same finding, different callers):**
```javascript
function mergeRuleA(existing, incoming) {
  const merged = { ...existing }
  merged.callers = [...new Set([...(existing.callers || []), ...(incoming.callers || [])])]
  if (incoming.confidence > existing.confidence) merged.confidence = incoming.confidence
  const sev = ['Low', 'Medium', 'High', 'Critical']
  if (sev.indexOf(incoming.severity) > sev.indexOf(existing.severity)) merged.severity = incoming.severity
  if (incoming.evidence && incoming.evidence !== existing.evidence) {
    merged._dedupCandidate = true
    merged._evidenceB = incoming.evidence
  }
  return merged
}
```

**Merge Rule B (tracer upgrade) — DEAD CODE, kept for spec reference only:**
```javascript
// RETIRED: mergeRuleB assumed suspected_taint suspects were pre-populated in allFindings.
// They are not — they live in allSuspects[]. Tracer now creates a NEW finding via Section G
// orchestration body (entry-side fingerprint + sink location from TRACER_SCHEMA).
// Keep this signature in shared/specs/dedup-spec.md as a historical record.
function mergeRuleB(existing, tracerOutput) {
  if (tracerOutput.action === 'ruled-out') return null   // remove from list
  return { ...existing, confidence: tracerOutput.confidence ?? 0.85,
    dataFlow: tracerOutput.dataFlow, status: 'confirmed' }
}
```

**Dedup engine:**
```javascript
function dedup(findings) {
  const map = new Map()
  for (const f of findings) {
    if (!map.has(f.fingerprint)) { map.set(f.fingerprint, f) }
    else { map.set(f.fingerprint, mergeRuleA(map.get(f.fingerprint), f)) }
  }
  return [...map.values()]
}

// Secondary dedup keyed on (file:line:checker) — separate from fingerprint dedup.
// A Pass 1 intra-module agent and a tracer confirmation can detect the same physical line
// with structurally different fingerprints (entry-side vs. sink-side key by design). Without
// this pass, the report shows two findings for one defect at different confidence levels.
//
// N12 fix — fingerprint stability: tracer upgrade findings are tagged _source:'tracer' at push
// time. When a tracer finding collides with a Pass 1 finding, the Pass 1 fingerprint (sink-side,
// keyed on actual code location, stable across runs) wins as the anchor. This prevents the case
// where LLM-generated tracer confidence promotes the entry-side fingerprint, causing a false
// regression + false fix pair in the ledger between runs for the same physical defect.
// Confidence: use Math.max — a well-evidenced tracer trace should keep its full confidence.
// The cap (N12 Round 5) is NOT applied here; it only applied to non-colliding findings — now moot.
function deduplicateBySinkLocation(findings) {
  const locationMap = new Map()
  const result = []
  for (const f of findings) {
    if (!f.file || !f.line) { result.push({ ...f }); continue }
    const locKey = `${f.file}:${f.line}:${f.checker}`
    const existingIdx = locationMap.get(locKey)
    if (existingIdx === undefined) {
      locationMap.set(locKey, result.length)
      result.push({ ...f })
    } else {
      const ex = result[existingIdx]
      // Fingerprint anchor: prefer Pass 1 (intra-module, sink-side) — identified by absence of _source:'tracer'.
      const exIsTracer = ex._source === 'tracer'
      const fIsTracer  = f._source  === 'tracer'
      const anchor = (exIsTracer && !fIsTracer) ? f    // f is Pass 1 → adopt its (sink-side) fingerprint
                   : (!exIsTracer && fIsTracer) ? ex   // ex is Pass 1 → keep its (sink-side) fingerprint
                   : f.confidence >= ex.confidence ? f : ex   // same type → higher confidence wins
      const other  = anchor === ex ? f : ex
      result[existingIdx] = {
        ...anchor,
        confidence: Math.max(ex.confidence, f.confidence),   // preserve highest confidence regardless of anchor
        callers:    [...new Set([...(ex.callers || []), ...(f.callers || [])])],
        dataFlow:   anchor.dataFlow?.steps?.length ? anchor.dataFlow : (other.dataFlow || anchor.dataFlow),
      }
    }
  }
  return result
}
```

**Pass 3 skip logic (all 7 conditions):**
```javascript
const VALID_MODES = ['full', 'pr', 'changed']

function shouldSkipPass3({ mode, scopedModules, secCriticalList, hasSecurityNeighbor,
    icaText, icaMissing, forcePass3, changedNotInGraph }) {
  if (!VALID_MODES.includes(mode)) { log(`WARNING: Unknown mode "${mode}" — defaulting to "full"`); mode = 'full' }
  if (forcePass3) return false                                                  // C7
  if (mode === 'full' && secCriticalList.length === 0) return false            // C1: unconfigured
  if (scopedModules.some(m => secCriticalList.includes(m))) return false       // C2: direct
  if (hasSecurityNeighbor) return false                                         // C3: graph neighbor
  // 'changed' mode scans a bounded diff like 'pr' — treat identically for ICEA/untracked checks
  const prLike = mode === 'pr' || mode === 'changed'
  if (prLike && icaText &&
      /auth|token|permission|role|encrypt|password|cors|credential|secret/i.test(icaText))
    return false                                                                 // C4: ICEA keyword
  if (prLike && icaMissing) return false                                       // C5: no ICEA
  if (prLike && changedNotInGraph) return false                                // C6: untracked
  return true
}
```

**Ledger merge (deterministic, all 5 rules — called in Workflow script, NOT delegated to LLM):**
```javascript
function updateLedger(existingLedgerRecords, newFindings, scanScope, today) {
  const ledger = existingLedgerRecords.map(r => ({ ...r }))
  const alerts = []

  for (const finding of newFindings) {
    const fp = finding.fingerprint
    const idx = ledger.findIndex(r => r.fingerprint === fp)
    if (idx === -1) {
      // Rule 1: new finding
      ledger.push({ fingerprint: fp, file: finding.file, checker: finding.checker,
        firstSeen: today, lastSeen: today, status: 'active', severity: finding.severity,
        passHistory: [{ date: today, found: true, severity: finding.severity, modulesScanScope: scanScope }] })
    } else {
      // Rule 2: existing finding
      const rec = ledger[idx]
      if (rec.severity !== finding.severity) alerts.push({ type: 'severity-changed', fingerprint: fp })
      rec.lastSeen = today
      rec.passHistory.push({ date: today, found: true, severity: finding.severity, modulesScanScope: scanScope })
      // Rule 4: was fixed, now found again
      if (rec.status === 'fixed') { rec.status = 'active'; alerts.push({ type: 'regression', fingerprint: fp }) }
      // Rule 5: false-positive seen again — do NOT escalate
      if (rec.status === 'false-positive') alerts.push({ type: 're-seen-fp', fingerprint: fp })
    }
  }

  // Rule 3: scope-aware missing check
  // DECISION: moduleId derivation from file path (split('/')[1]) is fragile for varying path depths.
  // Instead, derive moduleId by matching file path against known module IDs from current findings.
  const knownModules = newFindings.map(f => f.moduleId).filter(Boolean)
  for (const rec of ledger) {
    if (rec.status !== 'active') continue
    const derivedModule = rec.moduleId
      || (rec.file ? knownModules.find(m => rec.file.includes(m)) : null)
    if (!derivedModule) continue   // Can't determine scope — skip silently, no false regression alert
    if (RETIRED_CHECKERS.includes(rec.checker)) continue  // Rule 3B: retired checker — suppress alert forever
    const inScope = scanScope.includes('*') || scanScope.includes(derivedModule)
    if (!inScope) continue   // Rule 3A: out of scope — silent
    const foundThisRun = newFindings.some(f => f.fingerprint === rec.fingerprint)
    if (!foundThisRun) alerts.push({ type: 'regression-risk', fingerprint: rec.fingerprint })
  }

  return { ledger, alerts }
}
```

### Section D — Checker Taxonomy (inline constants)

```javascript
const CHECKERS_PASS1 = [
  'TAINTED_SQL', 'TAINTED_HTML', 'TAINTED_CMD', 'PATH_TRAVERSAL', 'CSRF',
  'HARDCODED_SECRET', 'NULL_DEREF', 'RESOURCE_LEAK', 'UNVALIDATED_REDIRECT',
  'MISSING_AUTH_CHECK', 'OVERLY_PERMISSIVE_CORS', 'SENSITIVE_DATA_LOG'
]

const CHECKERS_PASS3 = [
  'PRIVILEGE_ESC', 'AUTH_BYPASS', 'CROSS_TENANT_LEAK',
  'TRUST_BOUNDARY', 'TOKEN_FORGERY', 'SECOND_ORDER_INJECT'
]

// Severity ordering used in buildPersonaPrompt and report assembly — defined once here.
const SEV_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 }

// When checkers are renamed or removed from CHECKERS_PASS1/PASS3, add the old ID here.
// Without this, any active ledger record with a retired checker triggers regression-risk
// alerts on every subsequent run (it's in-scope but can never be re-found by any agent).
const RETIRED_CHECKERS = []   // e.g. ['OLD_CHECKER_ID', 'RENAMED_CHECKER']
```

### Section E — Prompt Builder Functions

**Pass 1 module agent prompt:**
```javascript
function buildPass1Prompt(module, depDetailFiles) {
  return `You are a static analysis engineer (SAST).

MODULE: ${module.moduleId} | SOURCE ROOT: ${module.sourceRoot}

TASK:
1. Use the Read tool to read all source files under ${module.sourceRoot}/
2. Read the module detail file: ${module.detailFile}
3. Read dependency detail files: ${depDetailFiles.join(', ')}
4. Apply these 12 checkers: ${CHECKERS_PASS1.join(', ')}
5. For intra-module findings: confidence=0.95, assign fingerprint sha1(file:function:line:checker) → "FP-{hex8}"
6. For cross-module suspicions: add to suspected_taint[] with confidence=0.30, pre-assign fingerprint

RULES:
- Only report findings with direct source evidence (3-5 line snippet in evidence field)
- Cross-module taints go in suspected_taint[], NOT confirmed findings
  - suspected_taint fingerprint = sha1(entry_file + entry_function + ":CROSS:" + suspected_sink_type)
  - Use entry location only — you cannot compute sink fingerprint without reading the sink file
- callers[] = list of moduleIds that call this module's affected function
- Stack-specific auth patterns:
  - .NET/C#: absent [Authorize] attribute on controller/action = MISSING_AUTH_CHECK
  - Java Spring: absent @PreAuthorize / @Secured = MISSING_AUTH_CHECK
  - Node.js: auth middleware not in handler chain = MISSING_AUTH_CHECK
- Return ONLY the JSON schema, no prose
// cache-key: ${module.contentHash || 'no-hash'}`
// NOTE: The trailing cache-key comment is invisible to the agent's instructions but changes
// the prompt text when source files change (contentHash from scope agent changes), causing
// a natural cache miss on --continue. Solves N9 staleness without touching the Workflow runtime.
}

```

**Taint tracer prompt:**
```javascript
function buildTracerPrompt(suspect) {
  const chain = suspect.call_chain.join(' → ')
  return `You are a taint tracer. Confirm or rule out a cross-module taint flow.

SUSPECT: ${suspect.fingerprint}
Entry: ${suspect.entry_file} :: ${suspect.entry_function}(${suspect.entry_param || 'input'})
Call chain: ${chain}
Suspected sink type: ${suspect.suspected_sink}

TASK:
1. Use the Read tool to read source files for each module in the call chain
2. Trace the data flow from entry parameter to the suspected sink
3. Check: does untrusted data reach the sink WITHOUT sanitization at any hop?
4. If YES → action:"upgrade", confidence:0.85, populate dataFlow.steps[] with confirmed hops
5. If NO → action:"ruled-out"

Chain >5 modules: read entry + sink + 3 nearest middle hops; mark dataFlow.traceIncomplete=true
Return ONLY the JSON schema.`
}
```

**Persona prompts (P1, P2, P3):**
```javascript
function buildPersonaPrompt(persona, allFindings) {
  const lenses = {
    P1: { name: 'P1 Reliability Engineer', context: 25, fullFile: false,
      focus: 'null paths, exception swallowing, resource cleanup on exception paths, retry without backoff',
      skip: null },
    P2: { name: 'P2 Concurrency Specialist', context: 25, fullFile: true,
      focus: 'shared mutable state without synchronization, TOCTOU, deadlock potential, async void',
      // DECISION: Don't gate P2 on existing findings having category:"concurrency" — CHECKERS_PASS1
      // contains no concurrency checkers, so allFindings will never have concurrency category after Pass 1.
      // P2 would always self-skip. Instead, gate on concurrency indicators in module/file names.
      skip: 'SELF-SKIP: Return decision:"not-applicable" ONLY if ALL finding.file and finding.moduleId values contain no concurrency indicators: async, Async, Task, Thread, Worker, Background, Queue, lock, Mutex, Semaphore, Interlocked, ConcurrentDictionary. When in doubt, proceed — a missed concurrency bug is worse than an unnecessary review pass.' },
    P3: { name: 'P3 API Contract Reviewer', context: 25, fullFile: false,
      focus: 'missing input validation, wrong HTTP status codes, no rate limiting on sensitive ops',
      skip: null },
  }
  const p = lenses[persona]
  const readInstruction = p.fullFile
    ? 'read the ENTIRE file (offset=0, limit=9999) — concurrency analysis requires full class visibility'
    : 'use Read(file, offset=max(0, finding.line - 12), limit=25) — 25 lines centered on the finding'
  // Sort by severity so highest-priority findings appear first when truncated to 50
  // SEV_ORDER is the module-level constant from Section D
  const findingsForPersona = [...allFindings]
    .sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0))
    .slice(0, 50)
  const truncNote = allFindings.length > 50
    ? ` (top 50 by severity; ${allFindings.length - 50} lower-severity omitted)` : ''
  return `You are ${p.name} reviewing code analysis findings.
${p.skip ? `SELF-SKIP CHECK: ${p.skip}\n` : ''}
FOCUS: ${p.focus}

CURRENT FINDINGS (${allFindings.length} total${truncNote}):
${JSON.stringify(findingsForPersona, null, 2)}

INSTRUCTIONS:
- For findings in your lens: ${readInstruction}
- Validate (confirm finding), Challenge (mark false-positive with reason), or Reduce-confidence (evidence weaker)
- You may add new-finding entries for issues you discover in source that are not in the list
- Only challenge means "conflicted" badge — reduce-confidence is silent editorial

Return ONLY the JSON schema (actions array).`
}
```

**Adversarial agent prompt:**
```javascript
function buildAdversarialPrompt(allFindings, archSecurityContent) {
  return `You are a security researcher attempting to break this system.

Do NOT review the findings list. Instead, actively look for:
— TOKEN_FORGERY: Can I forge or replay credentials?
— CROSS_TENANT_LEAK: Can I access another user's data?
— PRIVILEGE_ESC: Can I escalate privileges via parameter manipulation?
— AUTH_BYPASS: Can I bypass auth checks via unexpected code paths?
— SECOND_ORDER_INJECT: Can I corrupt data through stored injection?
— TRUST_BOUNDARY: Does untrusted data cross a trust zone without sanitization?

SECURITY ARCHITECTURE (your threat model baseline):
${archSecurityContent}

TASK:
1. Use Read tool to read source files of ALL security-critical modules listed in the architecture
2. Trace actual exploit paths — do not speculate
3. Return new findings only (pass:3, confidence:0.70)
4. Return empty findings[] if nothing found — never fabricate

Return ONLY the JSON schema.`
}
```

### Section F — Helper Functions

```javascript
// NOTE: Workflow scripts have no native write() — only agent() can write files.
// Use Haiku for checkpoints (file I/O only, no LLM reasoning) to minimize cost.
// Best-effort: if checkpoint agent fails, log warning but don't abort the scan.
async function writeCheckpoint(phase, data) {
  const result = await agent(
    `Write to .code-review/checkpoint-${phase}.json the following JSON exactly:\n${JSON.stringify({phase, ...data}, null, 2)}\nAlso append one line to .code-review/partial.html: <p>✅ ${phase} complete</p>`,
    { label: `checkpoint-${phase}`, model: args.haiku }
  )
  if (!result) log(`WARNING: checkpoint-${phase} write failed — --continue may not resume correctly from this phase`)
}

function applyPersonaActions(findings, persona, result) {
  if (!result || result.decision === 'not-applicable') return
  for (const action of result.actions || []) {
    const idx = findings.findIndex(f => f.fingerprint === action.fingerprint)
    if (idx === -1 && action.type !== 'new-finding') continue
    if (action.type !== 'new-finding') {
      if (!findings[idx].personaReviewStatus) findings[idx].personaReviewStatus = {}
    }
    if (action.type === 'challenge') {
      // Challenge is sticky — a later persona's 'validate' MUST NOT overwrite a challenge
      findings[idx].personaReviewStatus[persona] = 'challenged'
    } else if (action.type === 'validate') {
      // Only record 'validated' if this persona hasn't already challenged this finding
      if (findings[idx].personaReviewStatus[persona] !== 'challenged') {
        findings[idx].personaReviewStatus[persona] = 'validated'
      }
    } else if (action.type === 'reduce-confidence') {
      // Lowest confidence across personas wins (never raise via reduce-confidence)
      findings[idx].confidence = Math.min(findings[idx].confidence, action.newConfidence)
    } else if (action.type === 'new-finding') {
      findings.push({ ...action.finding, pass: 2,
        confidence: 0.80, personaReviewStatus: { [persona]: 'new' } })
    }
  }
}
```

### Section G — Main Orchestration Body

```javascript
// RESUME SEMANTICS (N3): When launched with resumeFromRunId, the Workflow runtime memoizes
// agent() calls by (prompt, opts). Completed calls return cached results instantly — zero API cost.
// Phases unconditionally re-run but agent() calls are short-circuited for completed work.
// This script does NOT need explicit "skip if resumed" guards — the runtime handles it transparently.
// Reference: Workflow tool description — "the longest unchanged prefix of agent() calls returns
// cached results instantly; the first edited/new call and everything after it runs live."
//
// LIMITATION (N9): Cache key is PROMPT TEXT, not source file content. If a developer fixes a
// vulnerability and runs --continue before the graph changes, buildPass1Prompt() produces the
// same string → cached "still vulnerable" result is served silently for that module.
// --continue is ONLY SAFE after an interrupted scan where source files were not modified.
// The graphHash check in SKILL.md guards graph-index.md changes only — not source changes.
// MITIGATION (N16): contentHash per module in SCOPE_SCHEMA — scope agent computes via git hash-object;
// buildPass1Prompt appends "// cache-key: ${contentHash}" — prompt changes when source changes.
//
// NOTE (N10): writeCheckpoint() agents always run live — they embed live counts (findingsCount,
// etc.) in their prompt text and can never produce a cache hit. --continue cost includes
// all checkpoint agents for phases that were completed; only module/tracer agents truly cache.

// PHASE 1: Scope
phase('Scope')
log('Reading graph and architecture context...')
// DECISION: Scope agent is single point of failure — retry once on failure before aborting.
const scopePrompt = `
Read .claude/graph/graph-index.md and list ALL modules with their sourceRoot, files, and detailFile.
Read .claude/architecture/architecture-security.md — extract security-critical-modules list and full content.
Read CodeReviews/code-review-ledger.md if it exists — parse the Markdown table rows into a JSON array of ledger records (one object per row: fingerprint, status, firstSeen, lastSeen, severity, file, checker, moduleId). Return empty array [] if absent.
For each module in scope, check graph edges: if any 1-hop neighbor (dependency or dependent) appears in the security-critical-modules list → set hasSecurityNeighbor: true on that module.
For each module, extract its dependency list from graph edges. Include moduleId and detailFile path for each dependency.
For each module, compute a contentHash: run \`git hash-object\` on each file in files[], concatenate the hashes, and take the first 8 hex chars of their combined SHA1. This hash is used as a cache-buster for --continue. If git is unavailable, leave contentHash empty.
Mode: ${args.mode}, scopeLimit: ${args.scopeLimit || 'none'}
${args.changedFiles ? `Changed files (--changed mode): ${args.changedFiles}
  → Set changedNotInGraph: true if ANY changed file falls outside all known module sourceRoots.` : ''}

Return JSON matching the SCOPE_SCHEMA.`

let scopeData = await agent(scopePrompt, { schema: SCOPE_SCHEMA, label: 'scope' })
if (!scopeData) {
  log('Scope agent failed — retrying once...')
  scopeData = await agent(scopePrompt, { schema: SCOPE_SCHEMA, label: 'scope-retry' })
}
if (!scopeData) {
  log('ABORT: Scope agent failed after retry. Verify .claude/graph/graph-index.md is valid.')
  return  // Clean exit — no partial findings written, no corrupted state
}

let modules = scopeData.modules
if (args.scopeLimit) modules = modules.slice(0, args.scopeLimit)
// --changed mode: restrict scan to modules that contain at least one changed file
if (args.mode === 'changed' && args.changedFiles) {
  const changedList = args.changedFiles.trim().split(/\s+/).filter(Boolean)
  modules = modules.filter(m =>
    changedList.some(f => f.startsWith(m.sourceRoot) || (m.files || []).includes(f))
  )
  if (modules.length === 0) {
    log('WARNING: --changed mode found no changed files within known graph modules.')
    // changedNotInGraph will be true from scope agent — Pass 3 will run even without direct hit
  }
}
// graphHash from SKILL.md (git hash-object) — written to checkpoint so --continue can detect graph changes
await writeCheckpoint('scope', { moduleCount: modules.length, graphHash: args.graphHash || '' })

// PHASE 2: Pass 1 (parallel, Haiku)
phase('Pass 1')
log(`Launching ${modules.length} module agents in parallel...`)
const pass1Results = await parallel(
  modules.map(m => () => agent(
    buildPass1Prompt(m, (m.dependencies || []).map(d => d.detailFile).filter(Boolean)),
    { schema: FINDINGS_SCHEMA, label: `pass1:${m.moduleId}`, model: args.haiku, phase: 'Pass 1' }
  ))
)

let allFindings = dedup(pass1Results.filter(Boolean).flatMap(r => r.findings || []))
const allSuspects = pass1Results.filter(Boolean).flatMap(r => r.suspected_taint || [])

// Fail-fast check (after parallel completes — parallel() never throws, failed agents return null)
// Also treat schema-valid but empty results ({}) as failures to catch silent schema errors
const pass1Failures = pass1Results.filter(r => r === null || !r.findings).length
if (pass1Failures / modules.length > 0.30) {
  log(`ABORT: ${pass1Failures}/${modules.length} Pass 1 agents failed (>30% threshold)`)
  await writeCheckpoint('abort', { reason: 'pass1-fail-fast', failures: pass1Failures })
  // Fall through to Report phase with partial findings
}

await writeCheckpoint('pass1', { findingsCount: allFindings.length, suspectCount: allSuspects.length })

// PHASE 2.5: Taint Tracer (parallel, Haiku, cap 50)
phase('Tracer')
const suspects = allSuspects.slice(0, 50)
if (allSuspects.length > 50) log(`Deferring ${allSuspects.length - 50} suspects — run /code-review --continue`)

// Guard: parallel([]) with empty input is untested — always check length before calling
let tracerResults = []
if (suspects.length > 0) {
  tracerResults = await parallel(
    suspects.map(s => () => agent(buildTracerPrompt(s),
      { schema: TRACER_SCHEMA, label: `tracer:${s.fingerprint}`, model: args.haiku, phase: 'Tracer' }
    ))
  )
} else {
  log('No taint suspects found in Pass 1 — tracer phase skipped')
}

// Tracer creates NEW confirmed findings — suspected_taint suspects are NOT pre-populated in allFindings.
// 'upgrade': create confirmed finding at sink location using entry-side fingerprint.
// 'ruled-out': suspect disproved — don't add to findings.
for (const result of tracerResults.filter(Boolean)) {
  if (result.action !== 'upgrade') continue
  // Fingerprint = entry-side fp (stable from module agent through ledger)
  allFindings.push({
    fingerprint:  result.fingerprint,
    checker:      result.checker,
    category:     'security',
    severity:     result.severity || 'High',
    confidence:   result.confidence ?? 0.85,   // No cap here — collision handling in deduplicateBySinkLocation
    _source:      'tracer',                     // Tag: distinguishes this from Pass 1 intra-module findings at dedup
    file:         result.sinkFile,
    function:     result.sinkFunction,
    line:         result.sinkLine,
    moduleId:     result.sinkModule,
    dataFlow:     result.dataFlow,
    pass:         1,
    evidence:     `Cross-module taint confirmed. Entry: ${result.dataFlow?.entry || '?'}, Sink: ${result.dataFlow?.sink || result.sinkFile}`,
  })
}

// Architecture spec: suspects that fail to trace (null result) OR exceed the 50-cap → Candidates.
// Without this, Candidates is always empty — the per-suspect entry/chain detail is lost to the developer.
const tracedFPs      = new Set(tracerResults.filter(Boolean).map(r => r.fingerprint))
const failedSuspects = suspects.filter(s => !tracedFPs.has(s.fingerprint))
const deferredSuspects = allSuspects.slice(50)

for (const suspect of [...failedSuspects, ...deferredSuspects]) {
  const isDeferred = !failedSuspects.includes(suspect)
  allFindings.push({
    fingerprint: suspect.fingerprint,
    checker:     'CROSS_MODULE_TAINT',
    category:    'security',
    severity:    'Medium',
    confidence:  0.30,   // Below 0.50 threshold → Candidates section
    file:        suspect.entry_file,
    function:    suspect.entry_function,
    line:        0,       // Sink not confirmed
    moduleId:    '',
    pass:        1,
    evidence:    `Suspected ${suspect.suspected_sink} taint. Chain: ${(suspect.call_chain || []).join(' → ')}. ${isDeferred ? 'Deferred past 50-suspect cap — run --continue to trace.' : 'Tracer timed out or failed — manual review required.'}`,
    dataFlow: {
      entry:           `${suspect.entry_file}::${suspect.entry_function}`,
      traceIncomplete: true,
      steps:           (suspect.call_chain || []).map(m => ({ module: m, confirmed: false }))
    }
  })
}

// Secondary dedup: merge findings that share (file:line:checker) — tracer and Pass 1 may
// detect the same physical defect with different fingerprints by design.
allFindings = deduplicateBySinkLocation(allFindings)

await writeCheckpoint('tracer', { findingsCount: allFindings.length })

// PHASE 3: Pass 2 Personas (parallel, Sonnet)
phase('Pass 2')
const [p1Result, p2Result, p3Result] = await parallel([
  () => agent(buildPersonaPrompt('P1', allFindings),
    { schema: PERSONA_SCHEMA, label: 'persona:P1', model: args.reviewModel, phase: 'Pass 2' }),
  () => agent(buildPersonaPrompt('P2', allFindings),
    { schema: PERSONA_SCHEMA, label: 'persona:P2', model: args.reviewModel, phase: 'Pass 2' }),
  () => agent(buildPersonaPrompt('P3', allFindings),
    { schema: PERSONA_SCHEMA, label: 'persona:P3', model: args.reviewModel, phase: 'Pass 2' }),
])

applyPersonaActions(allFindings, 'P1', p1Result)
if (p2Result?.decision !== 'not-applicable') applyPersonaActions(allFindings, 'P2', p2Result)
applyPersonaActions(allFindings, 'P3', p3Result)
await writeCheckpoint('pass2', { findingsCount: allFindings.length })

// PHASE 4: Pass 3 Adversarial (Sonnet, conditional)
phase('Pass 3')
const skip = shouldSkipPass3({
  mode: args.mode, scopedModules: modules.map(m => m.moduleId),
  secCriticalList: scopeData.securityCriticalModules || [],
  hasSecurityNeighbor: modules.some(m => m.hasSecurityNeighbor),
  icaText: args.icaText, icaMissing: args.icaMissing,
  forcePass3: args.forcePass3, changedNotInGraph: scopeData.changedNotInGraph || false,
})

if (!skip) {
  const aaResult = await agent(
    buildAdversarialPrompt(allFindings, scopeData.archSecurityContent),
    { schema: FINDINGS_SCHEMA, label: 'adversarial', model: args.reviewModel, phase: 'Pass 3' }
  )
  if (aaResult?.findings) allFindings.push(...aaResult.findings)
} else {
  log('Pass 3 skipped — no security-critical contact in scope + clean ICEA')
  log('To enable adversarial analysis: add security-critical: true to graph detail files and run /graph-sync.')
}
await writeCheckpoint('pass3', { findingsCount: allFindings.length, skipped: skip })

// PHASE 5: Report Assembly (Sonnet)
phase('Report')

// Ledger merge is DETERMINISTIC — done in Workflow script, NOT delegated to LLM
// DECISION: Final ledger is Markdown at CodeReviews/code-review-ledger.md (not JSON).
// JSON ledger is a future phase. findings-gate-precommit.sh reads the Markdown file.
// existingLedger is pre-parsed by the scope agent (JSON array) — no parseLedgerMarkdown() needed.
const existingLedgerRecords = scopeData.existingLedger || []
const today = args.today || 'today'   // passed from SKILL.md via args — Date.now() blocked in Workflow
const scanScope = args.scopeLimit ? modules.map(m => m.moduleId) : ['*']

// Only confirmed findings (confidence >= 0.50) go into the ledger.
// Candidates (confidence=0.30 suspects) are transient — they have no dismissal path in static HTML
// and would accumulate as permanent active ledger records with moduleId:'' and line:0.
// They are tracked in-report only; a future run that successfully traces them promotes them.
const confirmedForLedger = allFindings.filter(f => f.confidence >= 0.50)
const { ledger: updatedLedger, alerts } = updateLedger(existingLedgerRecords, confirmedForLedger, scanScope, today)

const confirmed = allFindings.filter(f => f.confidence >= 0.50)
const candidates = allFindings.filter(f => f.confidence < 0.50)
const conflicted = allFindings.filter(f =>
  Object.values(f.personaReviewStatus || {}).includes('challenged'))

// Guard: 500+ findings × ~300 bytes each ≈ 150KB+ inline JSON → context overflow on Sonnet.
// Priority order: Critical → High → Medium (capped) → Low omitted with note.
const MAX_PROMPT_FINDINGS = 200
const confirmedForPrompt = confirmed.length > MAX_PROMPT_FINDINGS
  ? [...confirmed.filter(f => f.severity === 'Critical' || f.severity === 'High'),
     ...confirmed.filter(f => f.severity === 'Medium').slice(0, 50)]
  : confirmed
const truncationNote = confirmed.length > MAX_PROMPT_FINDINGS
  ? `\n⚠️ TRUNCATED: ${confirmed.length - confirmedForPrompt.length} Medium/Low findings omitted from prompt. Write ALL findings from .code-review/checkpoint-pass2.json for the full ledger.`
  : ''

// Apply same overflow guard to candidates and conflicted — same risk, smaller arrays now
// but grows with N1 fix (untraced suspects land here as confidence=0.30 Candidates).
const candidatesForPrompt = candidates.length > 50
  ? [...candidates].sort((a, b) => (SEV_ORDER[b.severity]||0) - (SEV_ORDER[a.severity]||0)).slice(0, 50)
  : candidates
const conflictedForPrompt = conflicted.length > 50
  ? [...conflicted].sort((a, b) => (SEV_ORDER[b.severity]||0) - (SEV_ORDER[a.severity]||0)).slice(0, 50)
  : conflicted
const candidatesTruncNote = candidates.length > 50 ? ` — top 50 of ${candidates.length} shown` : ''
const conflictedTruncNote = conflicted.length > 50 ? ` — top 50 of ${conflicted.length} shown` : ''

await agent(`
Write the code review HTML report. You have STRUCTURED DATA — use it exactly as provided.

DATE: ${today}
SCAN SCOPE: ${modules.map(m => m.moduleId).join(', ')}

CONFIRMED FINDINGS (${confirmed.length} total, ${confirmedForPrompt.length} in prompt):
${truncationNote}
${JSON.stringify(confirmedForPrompt, null, 2)}

CANDIDATES (${candidates.length}${candidatesTruncNote}):
${JSON.stringify(candidatesForPrompt, null, 2)}

CONFLICTED (${conflicted.length}${conflictedTruncNote}):
${JSON.stringify(conflictedForPrompt, null, 2)}

LEDGER ALERTS (${alerts.length}):
${JSON.stringify(alerts, null, 2)}

COVERAGE: ${modules.length} modules scanned, ${allSuspects.length > 50 ? allSuspects.length - 50 + ' suspects deferred' : 'all suspects traced'}

WRITE THESE FILES:
1. CodeReviews/code-review-${today}.html — full HTML report (8 sections per spec in references/output-format.md)
2. CodeReviews/code-review-ledger.md — updated Markdown ledger (${updatedLedger.length} records)
3. .code-review/partial.html — SCAN COMPLETE status with summary

Do NOT run any analysis. Do NOT re-evaluate findings. Your job is HTML formatting and file writing only.

Read references/output-format.md for the exact report structure and finding card format.
`, { label: 'report', model: args.reviewModel, phase: 'Report' })

log(`Scan complete. Report: CodeReviews/code-review-${today}.html | Findings: ${allFindings.length}`)
```

---

## Step 3 — Fixture Files

**Directory:** `skills/code-review/test/fixtures/`

Seven files to create:

**`UserController.cs`** — MISSING_AUTH_CHECK at line 42 (no `[Authorize]` attribute on GetUserDetails endpoint)

**`UserService.cs`** — TAINTED_SQL at line 88 (string interpolation in SQL query: `$"SELECT * FROM Users WHERE name={name}"`)

**`UserRepository.cs`** — RESOURCE_LEAK at line 15 (SqlConnection opened without `using` block)

**`PaymentService.cs`** — HARDCODED_SECRET at line 7 (`private const string _apiKey = "sk-live-abc123xyz"`)

**`Clean.cs`** — No vulnerabilities (precision baseline, should produce 0 findings)

**`graph-index-fixture.md`** — 3-module graph:
- UserController (calls UserService)
- UserService (calls UserRepository)
- UserRepository (no outbound calls)

**`architecture-fixture.md`** — Minimal:
```yaml
security-critical-modules:
  - path: UserController.cs
    since: "2026-07-16"
```
Untrusted inputs: HTTP query parameters, request body.

---

## Step 4 — SKILL.md Rewrite

**File:** `skills/code-review/SKILL.md`

Transform from 3-pass single-agent to thin orchestrator entry point.

### New SKILL.md Structure (key sections)

```
---
name: code-review
description: >
  Multi-agent SAST code review. Fans out parallel per-module analysis,
  taint tracing, persona validation, and adversarial analysis.
  Triggers on: "/code-review", "run code review", "review the code"
---

# Code Review

_Skill version: 3.0 · Last changed: 2026-07-17 · Plugin compatibility: ≥3.12.0 · Consent: A_

## Model routing
Uses REVIEW_MODEL (default claude-sonnet-4-6) for assembly, personas, adversarial.
Uses HAIKU_MODEL (default claude-haiku-4-5-20251001) for Pass 1 module agents and tracer agents.
Override by setting REVIEW_MODEL or HAIKU_MODEL env vars. See $PLUGIN_DIR/skills/shared/model-routing-spec.md.

## Persona
[SAST] Wen Li — Static Analysis Engineer (orchestrator role)

## Purpose
Orchestrates multi-agent code review against the project knowledge graph.
Requires graph-index.md to exist (.claude/graph/graph-index.md).
Does NOT: run single-agent sequential scans, use file-cache.json, support --area flag.
NEVER accept --area flag — tell developer to use --scope N instead.
See $PLUGIN_DIR/skills/shared/business-context-severity.md for severity escalation rules.

## Step 0 — Prerequisites

### 0a — Graph check
  graph_check=$(test -f ".claude/graph/graph-index.md" && echo "found" || echo "missing")
If missing: STOP — tell developer to run /graph-sync first.

### 0b — Mode detection
Parse flags: --full (default), --pr, --changed, --scope N, --continue, --force-pass3.
If no flag and interactive: show numbered mode menu.

For --changed mode, compute changed files before launching Workflow:
```bash
changed_files=""
if [ "$mode" = "changed" ]; then
  # Diff against merge-base with target branch — covers committed feature-branch work.
  # git diff HEAD only shows uncommitted changes: an empty result for the primary use case
  # (committed branch before PR) would silently scan nothing.
  target_branch="${BASE_BRANCH:-main}"
  merge_base=$("C:/Program Files/Git/mingw64/bin/git.exe" merge-base HEAD "$target_branch" 2>/dev/null)
  if [ -z "$merge_base" ]; then
    merge_base="HEAD~1"   # fallback: single-commit diff
    echo "WARNING: Could not compute merge-base with '$target_branch' — diffing HEAD~1 instead."
  fi
  # Committed changes on this branch since branching from target
  changed_files=$("C:/Program Files/Git/mingw64/bin/git.exe" diff --name-only "${merge_base}...HEAD" 2>/dev/null | tr '\n' ' ')
  # Also include staged/unstaged changes not yet committed
  changed_files="${changed_files}$("C:/Program Files/Git/mingw64/bin/git.exe" diff --name-only HEAD 2>/dev/null | tr '\n' ' ')"
  # changedNotInGraph is computed by the scope agent based on changedFiles
fi
```

### 0c — ADO ID extraction
  branch=$("C:/Program Files/Git/mingw64/bin/git.exe" rev-parse --abbrev-ref HEAD 2>/dev/null)
  ado_id=$(echo "$branch" | grep -oP '(?i)ADO-?#?\K\d+' | head -1)

### 0d — ICEA lookup (PR mode only)
If mode = --pr AND ado_id exists:
```bash
# Use 'latest alphabetically = highest version' sort — tail -1 picks the canonical ICEA
icea_file=$(find docs/ -path "*UserStory*${ado_id}*" -name "ADO-${ado_id}-*.icea.md" 2>/dev/null | sort | tail -1)
if [ -n "$icea_file" ]; then
  icea_text=$(cat "$icea_file")
else
  icea_missing=true
fi
```
Note: pass only the first 4KB of icea_text to Workflow args if ICEA is large (keyword check only needs header/acceptance sections).

### 0e — Today's date and graph hash
  today=$(date +%Y-%m-%d)
  # Graph hash used by --continue to detect structural changes since last checkpoint
  graph_hash=$("C:/Program Files/Git/mingw64/bin/git.exe" hash-object .claude/graph/graph-index.md 2>/dev/null || echo "")

### 0f — Resume check
If mode = --continue:
```bash
resumeId=$(cat .code-review/last-run-id.txt 2>/dev/null)
# Guard: "COMPLETED" marker means last run finished cleanly — nothing to resume
if [ "$resumeId" = "COMPLETED" ]; then
  echo "Last scan completed successfully. No checkpoint to resume — starting fresh."
  resumeId=""
fi
# Validate checkpoint: compare graph file hash (more reliable than module count — detects structural changes)
if [ -f ".code-review/checkpoint-scope.json" ]; then
  checkpoint_hash=$(node -e "try{console.log(require('./.code-review/checkpoint-scope.json').graphHash || '')}catch(e){console.log('')}" 2>/dev/null)
  if [ -n "$checkpoint_hash" ] && [ -n "$graph_hash" ] && [ "$checkpoint_hash" != "$graph_hash" ]; then
    echo "WARNING: graph-index.md changed since checkpoint. Run /code-review --full to start fresh, or proceed with caution."
    # Do not exit — emit warning and let developer decide
  fi
fi
```

### 0g — Launch Workflow
```bash
# Resolve models from env (C4 fix: HAIKU_MODEL env var — not hardcoded string)
review_model="${REVIEW_MODEL:-claude-sonnet-4-6}"
haiku_model="${HAIKU_MODEL:-claude-haiku-4-5-20251001}"
# Capture report mtime BEFORE Workflow call — used in Step 0h to detect if THIS run wrote the report.
# Keying on file existence alone fails when two runs share the same date (stale file from earlier run).
report_file="CodeReviews/code-review-${today}.html"
pre_mtime=$(stat -c %Y "$report_file" 2>/dev/null || echo "0")
```
Call Workflow tool:
  - scriptPath: "skills/code-review/runners/workflow/code-review.workflow.js"
  - resumeFromRunId: <resumeId if --continue, else omit>
  - args:
    - mode: <detected mode>
    - scopeLimit: <N if --scope, else null>
    - forcePass3: <true/false>
    - icaText: <icea_text content or null>
    - icaMissing: <icea_missing boolean>
    - today: <today value>
    - reviewModel: <review_model>
    - haiku: <haiku_model>
    - graphHash: <graph_hash value>
    - changedFiles: <changed_files value, or null if not --changed mode>

### 0h — Capture run ID and emit progress URL
After Workflow returns, check whether THIS run wrote the report by comparing mtime (not file existence):
```bash
post_mtime=$(stat -c %Y "$report_file" 2>/dev/null || echo "0")
if [ "$post_mtime" != "0" ] && [ "$post_mtime" != "$pre_mtime" ]; then
  # Report mtime changed — this invocation wrote a new report → scan completed successfully
  echo "COMPLETED" > .code-review/last-run-id.txt
  echo "Report: CodeReviews/code-review-${today}.html | Progress: .code-review/partial.html"
else
  # mtime unchanged → Workflow returned but no report was written by this run.
  # A stale report from an earlier same-day run does NOT count as completion for this invocation.
  echo "${runId:-unknown}" > .code-review/last-run-id.txt
  echo "WARNING: Scan aborted — no new report generated. Check .code-review/checkpoint-abort.json."
  echo "Run /code-review --continue to retry, or /code-review --full to restart."
fi
```
Note: mtime comparison correctly handles two runs on the same date; file existence would give a false
COMPLETED if the first run succeeded and the second aborted, both using the same today date filename.

## Hard rules
- NEVER invoke Workflow without first checking graph-index.md exists
- NEVER pass PAT, secrets, or credentials in Workflow args
- NEVER perform any file analysis in SKILL.md — all analysis is in the Workflow script
- ALWAYS show the partial.html path so developer can monitor progress in browser
- WARN developer: "--continue is only safe after an interrupted scan — not after source file changes (N9)"
```

---

## Step 5 — Shared Spec Files (Documentation)

**Directory:** `skills/code-review/shared/`

These are Markdown reference documents, NOT runtime code. They document the logic embedded in the workflow script and serve as the specification for the future LangGraph Python runner. Each file must include frontmatter: `<!-- This is a specification document, not runtime code. The implementations are embedded in runners/workflow/code-review.workflow.js. -->`

| File | Purpose |
|---|---|
| `shared/README.md` | What's in shared/, how it relates to the workflow script, LangGraph roadmap |
| `shared/specs/dedup-spec.md` | Merge Rule A and B pseudocode, fingerprint key definition, collision detection |
| `shared/specs/schema-spec.md` | Finding field definitions, types, constraints, allowed enums |
| `shared/specs/skip-logic-spec.md` | Pass 3 truth table (all 7 conditions), ADO ID extraction regex |
| `shared/specs/ledger-merge-spec.md` | All 5 ledger merge rules in pseudocode |
| `shared/prompts/pass1-prompt-spec.md` | What the Pass 1 prompt must contain, what context to include |
| `shared/prompts/tracer-prompt-spec.md` | Tracer prompt requirements, chain truncation rules |
| `shared/prompts/persona-prompt-spec.md` | P1/P2/P3 focus areas, context window sizes, skip conditions |
| `shared/prompts/adversarial-prompt-spec.md` | Attack categories, what adversarial agent must NOT do |

---

## Step 6 — Graph Detail File Update

**File:** `.claude/graph/quality/code-review.md`

Update bounded context, key files list, dependencies, and patterns to reflect the multi-agent architecture. Keep existing format (required sections: bounded context, key files, dependencies, depended on by, patterns). Regenerate fingerprint after all skill files are stable.

---

## Step 7 — Test Scenarios

**File:** `tests/skill-scenarios/code-review.yaml`

```yaml
skill: code-review
scenarios:
  - id: no-graph-blocks
    description: "STOP shown if graph-index.md absent"
    input: "/code-review --full"
    expect:
      triggered: true
      contains: ["graph-sync", "graph-index"]
      not_contains: ["Pass 1", "Workflow"]

  - id: mode-menu-interactive
    description: "Mode menu shown with no flags"
    input: "/code-review"
    expect:
      triggered: true
      contains: ["--full", "--pr", "--scope"]

  - id: full-scan-invokes-workflow
    description: "Full scan calls Workflow with correct args structure"
    input: "/code-review --full"
    expect:
      triggered: true
      contains: ["code-review.workflow.js", "Pass 1", "Haiku"]
      not_contains: ["Pass 1 — Structured Rule-Based"]    # old single-agent language

  - id: force-pass3-bypasses-skip
    description: "--force-pass3 overrides skip logic"
    input: "/code-review --pr --force-pass3"
    expect:
      triggered: true
      contains: ["force-pass3", "adversarial"]
```

---

## Step 8 — Changelog and Migration

**File:** `CHANGELOG.md` — Add v3.13.0 entry:
```
### v3.13.0 — Multi-Agent Code Review (2026-07-17)
- code-review rewritten as multi-agent Workflow orchestrator (v3.0.0)
- Requires graph-index.md (.claude/graph/graph-index.md) — run /graph-sync first
- BREAKING: --area flag removed (replaced by --scope N + module graph)
- BREAKING: CodeReviews/ output preserved, .code-review/ added for checkpoints
- Single-agent area-scoped approach abandoned: misses cross-module vulnerabilities
- New: Phase 2.5 taint tracer (confirms cross-module taint flows, confidence 0.85)
- New: Pass 3 adversarial agent with explicit attack-goal prompts
- New: Phase checkpoints + partial.html for live progress monitoring
- New: --continue flag resumes from last checkpoint on failure
```

**File:** `docs/migrations/023-3.13.0.md` — migration steps for projects using code-review:
1. Run `/graph-sync` before first multi-agent code review
2. Remove any --area flags from scripts/aliases (use --scope N instead)
3. Update any CI scripts reading `.code-review/` (new dir) vs `CodeReviews/` (unchanged)

---

## Validation Checklist

### Validation Tiers (use highest available)

**Tier 1 — Node.js (primary, no API key needed):**
```bash
node tests/validate.js              # 259 structural checks, offline
node --check skills/code-review/runners/workflow/code-review.workflow.js  # syntax check
```

**Tier 2 — Python (skip if unavailable):**
```bash
python3 tests/validate.py           # equivalent to validate.js; skip if no Python
```

**Tier 3 — Bash fallback (when only bash is available):**
```bash
# scripts/validate-bash.sh — lightweight structural checks (NEW script to create)
# Checks: plugin.json skills array matches skills/ dirs, SKILL.md has required metadata line,
#         test scenario YAML exists per skill, no hardcoded ADO org in skill bodies
bash scripts/validate-bash.sh
```

**Tier 4 — Live LLM tests (only when API key is available):**
```bash
# Only run if ANTHROPIC_API_KEY is set
if [ -n "$ANTHROPIC_API_KEY" ]; then
  node tests/runner.js --skill code-review
fi
```

**A new file to create as part of this implementation:**
`scripts/validate-bash.sh` — bash-only structural gate covering:
- `plugin.json` skills list matches `skills/` directory names (`ls skills/` cross-check)
- Every skill in `skills/` has a `SKILL.md` with a `_Skill version_` metadata line
- Every skill has a corresponding `tests/skill-scenarios/<skill>.yaml`
- No skill body contains hardcoded ADO org strings (grep check)
- `skills/code-review/runners/workflow/code-review.workflow.js` exists
- `export const meta` is present in the workflow script

---

**Before writing code:**
- [ ] Run `node tests/validate.js` — record baseline (should be 259 passed / 0 failed)
- [ ] Verify `parallel()` null semantics: write a minimal test Workflow script that deliberately fails one agent — confirm the slot returns `null`, NOT that `parallel()` throws. If it throws: wrap in try/catch and restructure fail-fast. This must be confirmed before Step 2 — the entire resilience model depends on it.
- [ ] Verify `resumeFromRunId` memoization empirically (N3): run a 2-module workflow, interrupt after module 1 completes, resume with same runId — confirm module 1's agent returns instantly (cached) and module 2 runs live. Also confirm: modifying source files between runs does NOT invalidate the cache (validates N9 limitation statement).
- [ ] Confirm N9 --continue limitation with team: document prominently in output when --continue is used — "WARNING: --continue may serve stale cached results if source files changed since last run." (N16 contentHash mitigates this — verify empirically.)

**After Step 2 (workflow script):**
- [ ] `node --check skills/code-review/runners/workflow/code-review.workflow.js` — no syntax errors
- [ ] SHA1 implementation produces same hash for same input across Node.js restarts (stable fingerprints)
- [ ] `mergeRuleA()` takes HIGHEST confidence — never averages
- [ ] `mergeRuleB()` is present but dead — verify it is never called in orchestration body
- [ ] `shouldSkipPass3()` returns false for all 6 "run" conditions, true only for the clean case
- [ ] `updateLedger()` has all 5 rules; Rule 5 does NOT auto-escalate false-positives
- [ ] `deduplicateBySinkLocation()`: two findings with same `file:line:checker` but different fingerprints merge correctly; Pass 1 fingerprint wins anchor; confidence takes Math.max; callers unioned
- [ ] Tracer phase: null tracer results AND suspects beyond cap 50 appear in allFindings at confidence=0.30 → Candidates section not empty when suspects fail
- [ ] `RETIRED_CHECKERS = []` present in Section D; adding a known ID suppresses Rule 3 regression alert
- [ ] `--changed` mode: `changed_files` arg populated from merge-base git diff; scope filtered to affected modules
- [ ] `last-run-id.txt` contains "COMPLETED" after successful full scan (mtime-based check, not file existence); "COMPLETED" clears resumeId in Step 0f

**After Step 4 (SKILL.md):**
- [ ] Frontmatter `name: code-review` matches plugin.json
- [ ] `_Skill version: 3.0_` metadata line present with `Consent: A`
- [ ] `business-context-severity.md` referenced in body
- [ ] `model-routing-spec.md` referenced in body
- [ ] No duplicate step numbers

**After Step 7 (test scenarios):**
- [ ] `node tests/validate.js` → 259+ passed, 0 failed (primary gate)
- [ ] `bash scripts/validate-bash.sh` → all checks pass (bash fallback, run when validate.js unavailable)
- [ ] If `ANTHROPIC_API_KEY` set: `node tests/runner.js --skill code-review` → scenarios pass

Add to `tests/validate.js` (Step 9) — fixture line number validation:
```javascript
// Fixture line validation — vulnerability must be at declared line ±2
const fixtureExpectations = {
  'UserController.cs':  { marker: '// FINDING: MISSING_AUTH_CHECK', line: 42 },
  'UserService.cs':     { marker: '// FINDING: TAINTED_SQL',        line: 88 },
  'UserRepository.cs':  { marker: '// FINDING: RESOURCE_LEAK',      line: 15 },
  'PaymentService.cs':  { marker: '// FINDING: HARDCODED_SECRET',   line: 7  },
}
for (const [file, spec] of Object.entries(fixtureExpectations)) {
  const content = fs.readFileSync(`skills/code-review/test/fixtures/${file}`, 'utf8')
  const lines = content.split('\n')
  const actualLine = lines.findIndex(l => l.includes(spec.marker)) + 1  // 1-indexed
  assert(Math.abs(actualLine - spec.line) <= 2,
    `${file}: FINDING marker at line ${actualLine}, expected ${spec.line} ±2`)
}
```
Each fixture file must include a `// FINDING: <CHECKER>` comment on the vulnerability line.

**Integration test (fixture-based):**
- [ ] Run `/code-review --full` against `skills/code-review/test/fixtures/` as the target
- [ ] MISSING_AUTH_CHECK found in UserController.cs (Pass 1 recall)
- [ ] TAINTED_SQL found in UserService.cs (Pass 1 recall)
- [ ] At least one taint suspect upgraded by tracer (if graph edges are in fixture)
- [ ] Clean.cs produces 0 findings (precision check)
- [ ] Report HTML written with 8 sections
- [ ] Ledger updated with new entries

---

## Critic Review Summary (6 Rounds, ~60 Issues)

All issues resolved or explicitly documented as accepted limitations.

| Round | Issues | Status |
|---|---|---|
| Round 1 (AI Architect) | C1-C4 Critical, H1-H5 High, M1-M5 Medium, L1-L4 Low | All resolved in plan |
| Round 2 (Developer) | 15 issues: tracer fingerprint, parallel() semantics, persona sticky challenge, ledger path, etc. | All resolved in plan |
| Round 3 (Developer) | 15 issues: 10 false alarms (already fixed), 5 new fixes | False alarms documented; 5 fixes applied |
| Round 4 (Developer) | 8 issues: N1-N8 | N3 re-opened in R5; N1,N2,N4-N8 resolved |
| Round 5 (Developer) | 8 issues: N3 re-open, N9-N13 | All resolved; N3 gated on empirical verification |
| Round 6 (Developer) | 3 issues: N14,N15,N16 | All resolved: _source tag, mtime comparison, contentHash cache-buster |

**Key architectural decisions recorded in plan:**
- Entry-side fingerprint design (tracer creates NEW finding, not merge)
- `deduplicateBySinkLocation()` with `_source:'tracer'` anchor for stable ledger identity
- Only confirmed findings (confidence ≥ 0.50) passed to ledger
- contentHash per-module as --continue cache-buster (N16)
- mtime comparison for COMPLETED marker (N15)
- `RETIRED_CHECKERS` constant for permanent Rule 3 suppression (N6)
