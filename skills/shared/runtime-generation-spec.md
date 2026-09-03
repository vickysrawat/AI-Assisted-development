# Runtime-Generation Resolution Spec
_Spec version: 1.1 · Created: 2026-09-01 · Updated: 2026-09-03 · ADR 0059_
_Implemented by: `scripts/stack-signals.cjs` (`resolveGeneration` / `resolveAllGenerations`)_

The second tier of tech-stack detection: after the coarse stack is identified, pin the
**runtime generation** per language. Manifest-declaration first (offline, no consent); a
syntax-pattern fallback is **consent-gated** and lives in the architect skill.

## Shape

Uniform value `{ name, confidence, evidence }` (`confidence` ∈ 0.0–1.0):
- **Nested** under each scored language entry in `detection.<category>[]` when that language has
  a rule `stack_key` (e.g. `detection.language[0].generation`).
- **Keyed map** `state.generations` (sibling of `detection`) for every language whose manifest
  is present — including Ruby/PHP/Go/Rust, which have no rule `stack_key` today but whose
  generation is available to the migration/architect consumers.

`name` is the coarse bucket that consumers branch on; the exact version/declaration goes in
`evidence` (migration reads it for the precise target).

### .NET per-project spread (v1.1, P1-Shared)

The `.NET` generation object carries **additive** fields beyond `{name, confidence, evidence}` so
consumers can reason per-project (a solution has many projects/libs/tests on different TFMs).
`name` stays a scalar bucket for backward-compat; per-project truth lives in `versions[]`:

| Field | Meaning |
|---|---|
| `version` | representative **primary** TFM — highest modern TFM among *deployable* projects (`Sdk.Web` / `Sdk.Worker` / `<OutputType>Exe`), excluding tests & `netstandard*`; else highest non-test; else any |
| `versions[]` | per-project ground truth: `{ path` (repo-root-relative), `role` (`web`/`worker`/`exe`/`lib`/`test`)`, tfm` \| `tfms[]` (multi-target)`, generation` \| `generations[]` (SET when TFMs straddle net4↔net5+)`, tfmSource` (`inline`/`inherited`/`sdk-derived`/`none`)`, confidence }` |
| `heterogeneous` | `true` when application (non-test) projects span >1 distinct TFM |
| `generationsPresent` | union set of per-project generations, e.g. `['dotnet-modern','dotnet-framework']` — what the **set-based rule gate** reads |
| `packages` | `.NET` NuGet name→version map (PackageReference `Version`, both attr + child forms; CPM `Directory.Packages.props` merged for versionless refs) |

**Effective-TFM resolution (per project):** inline csproj `<TargetFramework(s)>` → nearest-ancestor
`Directory.Build.props` with a concrete TFM (`inherited`) → `global.json` `sdk.version` major →
`net{major}.0` (`sdk-derived`, low-confidence, SDK≠runtime) → `null`. Unresolved MSBuild `$(Var)`
is treated as unknown (no MSBuild engine). TFM is **authoritative** — weak signals (`System.Web`
string, stray `packages.config`) never override a definitive TFM; framework is only asserted at
high confidence, else detection fails safe toward `dotnet-modern`.

**Freshness (`state.generations_meta`):** `{ buildfile_fingerprint`, `detected_at }` — a hash over
the build-file set (csproj/props/global.json/packages.config path+mtime). `versions[]` is
**best-effort** (a point-in-time snapshot); graph-sync recomputes on fingerprint divergence and
setup-status flags staleness. Hot-path consumers may re-parse a single project if its csproj mtime
> `detected_at`.

## Buckets + primary (manifest) signal

| Stack | `name` buckets | Manifest signal → `evidence` |
|---|---|---|
| .NET | `dotnet-framework` / `dotnet-modern` | `<TargetFramework(Version)>`, SDK-style `<Project Sdk=…>`, `packages.config`, `System.Web` |
| Python | `python-2` / `python-3` | `python_requires` / `requires-python`; pyproject vs requirements |
| Java | `java-legacy` (≤8) / `java-modern` (11+) | `maven.compiler.release` / `<source>` / `sourceCompatibility`; `module-info.java`; Ant `build.xml` |
| Node | `node-legacy` / `node-modern` | `engines.node`; `"type":"module"`; pnpm/yarn2 lockfile |
| Ruby | `ruby-legacy` / `ruby-modern` | Gemfile `ruby '…'` |
| PHP | `php-legacy` / `php-modern` | composer `require.php` |
| Go | `go-modules` / `go-legacy` | `go.mod` `go 1.x` directive |
| Rust | `rust` | Cargo `edition` / `rust-version` |

Missing/ambiguous manifest → `<stack>-unknown` at low confidence (never a hard guess).

## Rule gating (today: .NET only)

A rule stack_key may declare `requiresGeneration` / `excludeGeneration` in
`STACK_SIGNALS_TABLE`. `scoreStacks` gates by **set membership** against `generationsPresent`
(falling back to `[name]` for stacks without a spread) — so a **mixed** repo deploys BOTH rule
sets, each intended for its own projects. Current gates: `csharp-framework48` / `ado-net-legacy` /
`ef6` / `wcf` require `dotnet-framework`; `csharp-dotnet` **requires `dotnet-modern`** (v1.1: was
`excludeGeneration: ['dotnet-framework']`; the flip preserves pure-framework behavior — no
`dotnet-modern` present → not deployed — while letting modern rules deploy in a mixed repo).
Other languages have no generation-split rules yet — their generation is state-only
(migration/architect).

## Consent-gated syntax fallback (architect)

`repo-detect` is non-interactive, so it never scans source. When a language's
`generation.confidence` is low (manifest missing/stale — e.g. the runtime was upgraded but
`python_requires` never bumped), the **architect** skill may raise confidence with a
**Category B** (`source-file-consent.md`) source scan using syntax patterns:
- Python: `print x` (no parens) ⇒ py2; `match`/`async` ⇒ 3.10+/3.5+
- Java: lambdas/streams ⇒ 8+; `var` ⇒ 10+; `record`/`sealed` ⇒ 16/17+; `module-info.java` ⇒ 9+
- Node: `require()`/`module.exports` ⇒ CJS-era; `import`/`export` ⇒ ESM
- Go: `errors.Is`/`errors.As` ⇒ 1.13+; generics ⇒ 1.18+
- PHP: typed properties / `match` ⇒ 8.0+

The fallback is optional, lower-confidence than a manifest declaration, and never silent — it
records the syntax evidence and re-stamps the generation entry.
