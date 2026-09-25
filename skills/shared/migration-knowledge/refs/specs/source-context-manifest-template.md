# Source Context Manifest — {MIGRATION_NAME} (ADO-{ID})
<!--
  Template for the source-context intake gate (source-context-intake-spec.md).
  Authored BEFORE options/analysis; verified by `scripts/intake-verify.cjs verify`.
  The verifier enforces (do NOT delete these sections):
    - Every migrationRoots entry (set by resolve-migration-roots.cjs) must appear ....... exit 3
    - Every PROV citation must resolve to a real file#line .............................. exit 4
    - No PARTIAL/unknown row whose source is reachable in a root ........................ exit 5
    - Every graph.json module needs a `mapped`/`out-of-scope` disposition ............... exit 7
    - Behaviour-bearing rows cite SOURCE (file#line), never a doc ....................... exit 8
    - Cross-cutting scan present + EVERY row source-grounded ............................ exit 9
      (rewrite/replatform: each row cites implementation file#line — a doc or blank fails, and one
       grounded row does NOT cover a doc-cited/blank sibling. upgrade may state "none".)
  Citation format: PROV as `relative/path#L<line>` — repo-relative, or relative to any
  migrationRoots entry. Replace every {placeholder}; leftover {…#L} will not resolve (exit 4).
-->

Verified: {date} · Skill: {rewrite|upgrade|replatform} · Source: {source app path}

## Source context files
_The source's own documented knowledge — read these before code._
| Doc | Path | Covered | PROV |
|---|---|---|---|
| agent instructions | CLAUDE.md | yes | CLAUDE.md#L1 |
| architecture | .claude/architecture/architecture.md | yes | .claude/architecture/architecture.md#L1 |
| local settings | .claude/settings.local.json | yes | .claude/settings.local.json#L1 |

## Migration roots
_One row per `migrationRoots` entry — source application first, then each BFS-discovered dependency repo. Every root MUST appear here (verifier enforces, exit 3 if any root is absent)._
| Root | Purpose | Covered | PROV |
|---|---|---|---|
| {source-app-name} | Primary source application | yes | CLAUDE.md#L1 |
| {../DealDataService} | WCF service dependency (Tier 2) | yes | {../DealDataService/Service.cs#L1} |

## Cross-cutting concern scan
_Impl, not declaration. Add a row for EVERY concern the source exhibits; cite the implementation
`file#line`. Delete a row only if the source genuinely lacks that concern (upgrade: state "none")._
| Concern | Implementation (what / where) | PROV |
|---|---|---|
| logging | {logger + where configured} | {src/…#L} |
| authN/authZ | {auth scheme + enforcement point} | {src/…#L} |
| error-handling | {global handler / filter / middleware} | {src/…#L} |
| tracing/correlation | {correlation-ID / behavior tracer} | {src/…#L} |
| caching | {cache + keys} | {src/…#L} |
| resilience | {retry / circuit-breaker} | {src/…#L} |
| validation | {validation approach} | {src/…#L} |
| DI/interception | {interceptors / behaviors / middleware chain} | {src/…#L} |
| config/secrets | {config transforms / Web.config behaviors / Key Vault} | {src/…#L} |

## Source coverage (full accounting)
_Every `graph.json` module → `mapped` or `out-of-scope`. Unlisted module = silent drop (exit 7)._
| Source module | Disposition | Reason | PROV |
|---|---|---|---|
| {ModuleA} business-logic | mapped | {target cluster} | {src/…#L} |
| {ModuleB} | out-of-scope | {why excluded} | {src/…#L} |
