# Spec: Source-Context Intake Gate

_A reusable, fail-closed source-analysis gate invoked by every migration-family skill
(Upgrade · Rewrite · Replatform) BEFORE options / gap-risk analysis. Turns "the source was read"
into a verifiable artifact (the Source Context Manifest) whose citations must resolve, and chains a
downstream step to it so it cannot be skipped._

> Design of record: `docs/plans/migrationSkill/source-context-intake-gate.md`.
> Companion to `integration-verification-spec.md` (this gate enforces that spec's Tier 2 rule).

## Why (root cause)
A rule gets skipped when nothing downstream depends on it. Intake reads were advisory, so analysis
proceeded on assumptions. This gate makes a required later step mechanically unable to succeed until
the manifest verifies.

## The artifact — Source Context Manifest
Written to `docs/migrations/{MIGRATION_ID}/source-context-manifest.md` before any analysis. Author it
from `source-context-manifest-template.md` (this directory) — the template's tables are shaped for the verifier.

Sections: **Source context files** · **Additional roots** (each `additionalDirectories` entry) ·
**Cross-cutting concern scan** (impl, not declaration) · **Source coverage** (every `graph.json`
module → `mapped` | `out-of-scope` + reason). Every substantive row carries `PROV: {path}#{line}`.

Rules:
- No PROV / a PROV that does not resolve to a real file+line = **not read**.
- Every `graph.json` module must have a `mapped`/`out-of-scope` disposition — unreferenced = silent drop.
- Behavior-bearing units (`business-logic` / `b-series` / `integration`) MUST cite a **source**
  `file#line` — citing a doc for them counts as not read.
- `PARTIAL` while the resolving source is reachable in a configured root is prohibited.

## Per-skill manifest depth
| Section | rewrite | replatform | upgrade |
|---|---|---|---|
| Source context files | required | required | required |
| Additional roots read | required | required | required |
| Cross-cutting concern scan | required (deep) | infra-relevant | delta only |
| Dependency Tier-2 classification | required | required | breaking integrations only |
| **Source coverage (full accounting)** | required | required | required |

## Binding — where each skill runs it
| Skill | Runs `verify` at | Fail-closed chain point |
|---|---|---|
| rewrite | Step 1.5 (before Step 2 options) | `rewrite-decompose.cjs decompose` calls `check-gate` first |
| replatform | Step R1 (before options) | `replatform-plan.cjs plan` calls `check-gate` first |
| upgrade | Step 3 (inside gap/risk analysis) | `upgrade-checkpoint.cjs set-gate --gate=report` refuses unless PASS |

## The gate — `scripts/intake-verify.cjs`
`verify` produces the verdict (exits 0/2–8); the skill records `stage_gates.intake_context=PASS` +
`core.source_context` on exit 0. `check-gate` re-validates from the ledger (manifest exists,
citations ≥ expected roots, `modules_mapped + out_of_scope == modules_total`) so a hand-set gate is
not trusted. See the script's SCRIPT REVIEW header for the exit-code contract.

## Two-layer detection
- Script (deterministic, `intake-verify.cjs`): root coverage (exit 3), citation resolution (exit 4),
  PARTIAL contradiction (exit 5), unwired-dependency diff (exit 6), full module accounting (exit 7),
  behaviour-cited-to-doc (exit 8), and cross-cutting scan presence + per-row source-grounding (exit 9). The
  script proves the scan EXISTS and is cited to source — it cannot prove it is COMPLETE.
- Judge (at the gate): completeness. Confirms `unwired_candidates[]` semantically and — the part the
  script cannot do — that the cross-cutting scan ADDRESSED every concern class the source actually
  exhibits, rather than filling a convenient subset. Rubric below.

## Judge rubric — intake gate
_The judge sees: the Source Context Manifest, `graph.json`, the configured source roots (repo +
`additionalDirectories`), and the Integration Inventory — never the author's reasoning. Verdict
grammar per `../../../judge.md` (PASS · REVISE · BLOCK); default to REVISE/BLOCK when uncertain._

Checks:
1. **Unwired candidates** — each `unwired_candidates[]` entry is a genuine dependency (not a
   false positive from the namespaced-identifier regex) and is either wired (`additionalDirectories`)
   or justified in the manifest with a reason. A real, unwired, behaviour-bearing dependency → BLOCK.
2. **Cross-cutting completeness** — for every concern class DETECTABLE in the source (signals below),
   the scan has a row citing the concern's IMPLEMENTATION (`file#line`), not just its registration or a
   doc. A concern present in source but absent from the scan → REVISE; a **security** concern
   (authN/authZ, secrets) present but unaddressed → BLOCK.
3. **No empty-by-declaration** — a row that states "none"/"n/a" for a concern the source clearly
   exhibits is a false negative → REVISE.
4. **Behaviour grounding** — spot-check that cited `file#line`s contain the concern's LOGIC, not a
   using/import or DI registration line only.

### Concern classes → detection signals (source has X ⇒ the scan must address X)
| Concern class | Detect in source by (packages / config / patterns) |
|---|---|
| Logging / telemetry | Serilog · NLog · log4net · Microsoft.Extensions.Logging · Application Insights · OpenTelemetry · Winston · Pino · SLF4J/Logback |
| AuthN / AuthZ (security) | ASP.NET `[Authorize]` · Identity · JWT bearer · OAuth/OIDC · cookie auth · Passport.js · Spring Security · WCF `<security>` |
| Error handling | global exception filter/middleware · `UseExceptionHandler` · `@ControllerAdvice` · Express error middleware · WCF `IErrorHandler` (endpoint behavior) |
| Tracing / correlation | correlation-ID middleware · distributed tracing · W3C `traceparent` · custom message/behavior tracers (e.g. WCF `eventTracer` / `conversationTracer` behaviors) |
| Caching | `IMemoryCache` · Redis · output/response caching · `@Cacheable` |
| Resilience | Polly · retry / circuit-breaker · Resilience4j · timeout policies |
| Validation | FluentValidation · model/data annotations · class-validator · Bean Validation |
| DI / interception (cross-cutting wiring) | Autofac/Castle interceptors · MediatR pipeline behaviours · Spring AOP · Angular HTTP interceptors · Express middleware chain · WCF endpoint/message behaviors |
| Config / secrets | Key Vault · `Web.config`/`app.config` transforms · WCF `<behaviors>` blocks · appsettings environment overrides |

> WCF endpoint/message **behaviors** (the `<behaviors>` block in `Web.config`) are the classic blind
> spot: `errorHandler`, `eventTracer`, `conversationTracer` are cross-cutting concerns declared in
> config and implemented in code — both the declaration AND the implementation must appear in the scan.

## Hard rules
- NEVER present options / produce the gap-risk report before `verify` exits 0 and the gate is recorded.
- NEVER accept `PARTIAL` when the resolving source is reachable in a configured root.
- EVERY graph module must be accounted for; a behavior-bearing unit MUST cite source, not a doc.
- EVERY cross-cutting concern row must cite source (`file#line`) — per-row, not section-wide: a single
  grounded row does NOT cover a doc-cited or blank sibling (exit 9). Cross-cutting is first-class.
- `check-gate` re-validates — a `set-gate PASS` without a passing manifest is not honored.
- Reuse `scanRoots()` from `multi-root-scan.md` for roots — never re-improvise root logic.
