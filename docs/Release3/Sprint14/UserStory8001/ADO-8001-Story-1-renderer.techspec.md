# Tech Spec — Story 1: Renderer, scanner and skill scaffold
ADO #8001 · Story 1 of 3 · Release 3 · Sprint 14
Status: DRAFT · 4 SP · Depends on: none

---

## Overview

This story brings the generic renderer from ADO-90 into the plugin as `scripts/architecture-diagram.py` and extends it:
- 12 hosting presets
- a `--check` mode, which runs the ADO-90 overlap and routing checks in-process and exits 1 on any problem
- a `todo: true` flag on components and flows, the D-1 Option A unverified style

It also adds:
- `scripts/arch-spec-scan.cjs`: secret scan and hostname/IP listing for spec files. Story 2 calls it before save; this story's AC-F13 allow-list test uses its host extraction.
- five example specs with made-up content
- the jest tests, which skip cleanly without Python

The skill is scaffolded here with `scripts/new-skill.sh arch-diagram`, because the examples live in its folder and the scaffold refuses an existing folder. This story's `SKILL.md` supports only `/arch-diagram --spec <file>`:
1. dependency check
2. render
3. `--check`
4. show the PNG

Spec generation arrives in Story 2.

Pattern: the LLM reads and decides; scripts draw and check deterministically. The renderer contract from ADO-90 (spec keys, layout, routing) stays backward compatible.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | Skill registered and runnable: skill, command stub, plugin.json, README row, scenario file | `skills/arch-diagram/SKILL.md`, `_project-deploy/commands/arch-diagram.md`, `.claude-plugin/plugin.json`, `README.md`, `tests/skill-scenarios/arch-diagram.yaml` (all via `new-skill.sh`) | ✅ Covered |
| AC-F2 | Stop before evidence collection when python / matplotlib / pyyaml is missing; write nothing | `skills/arch-diagram/SKILL.md` Step 1, `tests/skill-scenarios/arch-diagram.yaml` | ✅ Covered |
| AC-F3 | Renders examples, renders an ADO-90-format spec unchanged, renders the 12 new presets | `scripts/architecture-diagram.py`, `skills/arch-diagram/references/examples/*.yaml`, `tests/architecture-diagram.test.cjs` | ✅ Covered |
| AC-F4 | `--check` exit 0 clean / exit 1 listing problems | `scripts/architecture-diagram.py`, `tests/architecture-diagram.test.cjs` | ✅ Covered |
| AC-F13 | Allow-list test: hostnames RFC 2606, IPv4 RFC 5737, in `skills/arch-diagram/**` and `tests/fixtures/arch-diagram/**` | `scripts/arch-spec-scan.cjs` (`extractHosts`), `tests/architecture-diagram.test.cjs` | ✅ Covered |
| AC-F14 | `todo: true` gives amber dashed border + "⚠ unverified", grey flow, legend entry only when present | `scripts/architecture-diagram.py`, `tests/architecture-diagram.test.cjs` (rendering half). The skill half (every `⚠ TODO` item also gets `todo: true`) is in Story 2 Step 5 + `checkSources` | ✅ Covered |
| AC-NF3 | `npm test` passes without Python; Python cases report the skip | `tests/architecture-diagram.test.cjs` | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `scripts/architecture-diagram.py` | AC-F3, AC-F4, AC-F14 |
| `scripts/arch-spec-scan.cjs` | AC-F13 (host extraction); AC-F7 (`--secrets`, `--hosts`, `--stdin` — built here, wired into the skill in Story 2) |
| `skills/arch-diagram/SKILL.md` | AC-F1, AC-F2 |
| `skills/arch-diagram/references/examples/{kubernetes,azure-app-service,onprem-iis,docker-compose,node-server}.yaml` | AC-F3, AC-F13 |
| `_project-deploy/commands/arch-diagram.md` | AC-F1 |
| `.claude-plugin/plugin.json` | AC-F1 |
| `README.md` | AC-F1 |
| `tests/skill-scenarios/arch-diagram.yaml` | AC-F1, AC-F2 |
| `tests/architecture-diagram.test.cjs` | AC-F3, AC-F4, AC-F13, AC-F14, AC-NF3 |
| `tests/arch-spec-scan.test.cjs` | AC-F13 (`extractHosts`, `isDocHost`), AC-F7 (`scanSecrets`) |

**Coverage result:** all 7 Story 1 ACs covered, no orphaned file changes ✅

---

## DO NOT rules (apply to every file in this spec)

- DO NOT put a real application name, organisation, hostname or IP in any file. Use `contoso`, `*.example.com` and RFC 5737 addresses only.
- DO NOT change the meaning of any ADO-90 spec key. New keys (`todo`) are optional with a default of `false`.
- DO NOT use `yaml.load`. Use `yaml.safe_load` only.
- DO NOT shell out or `eval` anything from a spec.
- DO NOT add Python packages to `package.json` or any requirements file. Python is a documented prerequisite, not a dependency.
- DO NOT let a jest case fail when Python is missing. Skip it with the notice.
- DO NOT omit the `SCRIPT REVIEW` header on `.cjs` files. `script-review-gate` blocks the write.

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 0 | `skills/arch-diagram/`, `_project-deploy/commands/arch-diagram.md`, `tests/skill-scenarios/arch-diagram.yaml`, `.claude-plugin/plugin.json`, `README.md` | Scaffold | `./scripts/new-skill.sh arch-diagram`, run first. Commit its output unchanged, then edit rows 1–2 |
| 1 | `skills/arch-diagram/SKILL.md` | Skill | Frontmatter description and triggers; infrastructure model tier; Step 1 dependency check; `--spec <file>` render mode (Steps R1–R3); Hard Rules |
| 2 | `tests/skill-scenarios/arch-diagram.yaml` | Test | Replace the placeholder: trigger, missing python, missing matplotlib, missing pyyaml, `--spec` render |
| 3 | `scripts/architecture-diagram.py` | Script | Copy of the ADO-90 renderer (black-formatted) + presets + `todo` + `--check` |
| 4 | `scripts/arch-spec-scan.cjs` | Script | New. `--secrets` / `--hosts` / `--stdin` / `--json`; exports `scanSecrets`, `extractHosts`, `isDocHost` |
| 5 | `skills/arch-diagram/references/examples/kubernetes.yaml` | Example | Made-up rewrite of the ADO-90 Kubernetes example. Primary and failover site; no source names kept |
| 6 | `skills/arch-diagram/references/examples/azure-app-service.yaml` | Example | Made-up Azure PaaS app (Front Door, App Service, Azure SQL, Key Vault). The ADO-90 source uses `expenses.contoso.com`, which fails the allow-list; rewrite it as `expenses.contoso.example.com`. Apply the same rule to every host in rows 5–9 |
| 7 | `skills/arch-diagram/references/examples/onprem-iis.yaml` | Example | Made-up IIS farm (load balancer, two `iis-server`, `sql-server`, `file-share`, `backup`) |
| 8 | `skills/arch-diagram/references/examples/docker-compose.yaml` | Example | New. `docker-host` with `compose-service` api / worker, postgres `database`, redis, nginx `reverse-proxy` |
| 9 | `skills/arch-diagram/references/examples/node-server.yaml` | Example | New. `linux-server` → `reverse-proxy` + `process-manager` → two `node-server`; includes one `todo: true` component and one `todo: true` flow |
| 10 | `tests/architecture-diagram.test.cjs` | Test | Renderer cases (skippable) + allow-list case (always runs) |
| 11 | `tests/arch-spec-scan.test.cjs` | Test | Scanner unit cases (no Python needed) |

### AC Traceability

See the AC Coverage Matrix above. Every code section below carries `# AC-Fx` / `// AC-Fx` on the relevant lines.

---

## Python Script — scripts/architecture-diagram.py

### CLI contract (shared with Story 2)

```
python scripts/architecture-diagram.py <spec.yaml|json> <output.png> [--dpi N] [--check]
  exit 0  rendered; with --check: 0 problems
  exit 1  "spec error: …" (no PNG written), or --check found problems (PNG still written, problems listed)
  exit 2  usage error (argparse)
```

`--check` output is one line per problem, prefixed `check:`, then a summary line: `check: N problems` or `check: ok`. Story 2's skill parses only the exit code and echoes these lines.

### Presets — added to `TYPES` (AC-F3)

| type | tag shown | family (fill/edge reuse) |
|---|---|---|
| `docker-host` | Docker host | container |
| `compose-service` | Compose service | container |
| `node-server` | Node.js | service |
| `process-manager` | Process manager | service |
| `reverse-proxy` | Reverse proxy | ingress |
| `linux-server` | Linux server | server |
| `container-apps` | Azure Container Apps | app-service |
| `aws-ecs` | AWS ECS | kubernetes |
| `aws-lambda` | AWS Lambda | function-app |
| `aws-rds` | Amazon RDS | database |
| `s3` | Amazon S3 | storage |
| `app-server` | App server | server |

Each preset reuses an existing family's colours. No new colour palette is introduced, so diagrams stay consistent. An unknown type still warns and renders as a plain box with the spec's `tag` (unchanged ADO-90 behaviour).

### `todo: true` — D-1 Option A (AC-F14)

```python
TODO_EDGE = "#D98E04"      # amber
TODO_FLOW = "#9E9E9E"      # grey
TODO_TAG = "⚠ unverified"

# build(): Node.todo = bool(raw.get("todo", False)); Flow.todo likewise     # AC-F14
# draw_box(): if node.todo → edgecolor=TODO_EDGE, linestyle=(0, (4, 2)), tag line = TODO_TAG
# draw_flow(): if flow.todo → color=TODO_FLOW (kind style otherwise unchanged)
# legend_entries(zones, flows) -> list: kinds used + ("Unverified (⚠ TODO)", TODO_EDGE dashed)
#   only if any node/flow .todo — pure function, called by draw_legend()   # AC-F14
```

- `todo` must be a boolean. Any other value is `spec error: todo must be true or false (component <id>)`.
- Glyph check: the default font (DejaVu Sans) contains U+26A0. The test asserts that rendering emits no `Glyph … missing` warning.

### `--check` (AC-F4)

Moves the ADO-90 scratch verifier (TC-P4-01 / TC-P5-01) into the script as `check(zones, flows, router) -> list[str]`:

| Check | Problem text |
|---|---|
| Sibling boxes overlap (same parent, or zones in the same row) | `check: overlap <a> / <b>` |
| Child box not fully inside its parent | `check: <child> not inside <parent>` |
| Arrow segment not orthogonal | `check: diagonal segment in flow <badge>` |
| Arrow crosses a box outside the src/dst ancestor chains (excluding `stack` and zones) | `check: flow <badge> crosses <box>` |
| Arrow start or end not on its box edge | `check: flow <badge> does not start/end on box edges` |
| Router fell back to a straight line | `check: no clear path for flow <badge>` |

`Router.route` already prints the `no clear path` warning. It also appends the badge to `self.fallbacks`, so `check()` can count it without parsing stderr.

### Backward compatibility (AC-F3)

The ADO-90 spec format is unchanged:
- top level: `title`, `subtitle`, `width`
- `zones[]`: `id`, `name`, `row`, `span`, `style`, `columns`, `note`, `details`, `components[]`
- components: `id`, `name`, `type`, `details`, `standby`, `tag`, `color`, `fill`, `columns`, `children`
- `flows[]`: `from`, `to`, `label`, `kind`, `id`

The only new key is `todo`, accepted on components and flows. The test renders a copy of the original ADO-90 Azure example, with names replaced, without `todo` keys, and expects exit 0 and no warnings.

---

## Node Script — scripts/arch-spec-scan.cjs

```js
// SCRIPT REVIEW
// Purpose : secret scan + hostname/IP listing for /arch-diagram spec files (ADO-8001)
// Inputs  : file path(s) as argv, or --stdin; flags --secrets --hosts --json
// Outputs : stdout report or JSON; exit 1 when --secrets finds a match, else 0
// Side effects: none (read-only)

const PATTERNS = [            // AC-F7 (used by Story 2); YAML key: value AND key=value forms
  { label: 'password',          re: /(?<![A-Za-z])(?:password|passwd|pwd)(?![A-Za-z])\s*[:=]\s*(?!["']?\s*(?:\{\{|<|\*{3,}|your[-_]|xxx|placeholder|changeme|$))\S{4,}/im },
  { label: 'secret/token/key',  re: /(?<![A-Za-z])(?:secret|client[_-]?secret|token|api[_-]?key|access[_-]?key)(?![A-Za-z])\s*[:=]\s*["']?(?!\{\{|<|\*{3,}|your|xxx)[A-Za-z0-9_\-+/=]{10,}/im },
  { label: 'connection string', re: /(?:Password|Pwd)=[^;'"\s]{4,}/i },
  { label: 'SAS signature',     re: /[?&]sig=[A-Za-z0-9%+/=]{20,}/ },
  { label: 'AWS access key ID', re: /AKIA[0-9A-Z]{16}/ },
  { label: 'OpenAI/Anthropic key', re: /sk-[A-Za-z0-9_\-]{32,}/ },
  { label: 'URL with credentials', re: /https?:\/\/[^:@\s]{1,64}:[^@\s]{1,64}@/ },
  { label: 'Azure storage key', re: /AccountKey=[A-Za-z0-9+/=]{40,}/ },
  { label: 'private key',       re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
```

- **Input:** file paths, or `--stdin` to read the text from standard input (`fs.readFileSync(0, 'utf8')`). Story 2 uses `--stdin`, so an unapproved draft never touches disk.
- **`scanSecrets(text)`** returns `[{line, label}]`. Line numbers are 1-based so Story 2 can print "❌ BLOCKED — secret pattern at spec line N".
- **`extractHosts(text)`** returns `[{line, value, kind: 'host'|'ip'}]`. It deliberately does **not** match every dotted token, so code and prose such as `e.g.`, `process.env`, `module.exports`, `yaml.safe_load`, `matplotlib.pyplot` and `Db.Endpoint.Address` are not reported. It finds candidates four ways:
  1. **URL hosts:** the authority part of `scheme://host[:port]`.
  2. **Host-like key values:** for the keys `host`, `hostname`, `server`, `server_name` (nginx), `endpoint`, `url`, `fqdn`, `domain`, `Data Source`, `Server=` in YAML / JSON / `.conf` / `.env` / connection-string forms. This also catches dotless server names.
  3. **TLD-shaped free text:** `\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|local|internal|corp|lan|intra|cloud|dev|app|test|invalid)\b`. Code spans and non-YAML fenced blocks in `.md` files are skipped; ```yaml fences are scanned like YAML files.
  5. **Strict mode (`strict: true`, used only by the AC-F13 test):** also flags any dotted name whose final label is 2+ letters, outside the file-extension list and known identifiers (`process.env`, `module.exports`, …). This catches country-code TLDs such as `.co.uk` or `.de`.
  4. **IPv4 dotted quads**, anywhere.
- **`isDocHost(value)`** returns true when either:
  - the host ends in `example.com`, `example.org`, `.test` or `.invalid`, or
  - the IP is in `192.0.2.0/24`, `198.51.100.0/24` or `203.0.113.0/24`

  `localhost` and `127.0.0.1` are also allowed, because they disclose nothing.

Key matching uses `(?<![A-Za-z])`, not `\b`, so prefixed names such as `DB_PASSWORD` and `SESSION_SIGNING_SECRET` are caught.

Test strings that look like secrets are assembled at runtime (for example `'Pass' + 'word=' + 'abcd1234'`), so the test files themselves never trip the commit gate.

The patterns are a superset of `validate-governance.cjs` `SECRET_PATTERNS`. That file is not touched: it is the commit gate, and it does not export its patterns. The shared-module merge is a follow-up (see Epic Handover).

---

## Skill — skills/arch-diagram/SKILL.md (Story 1 scope)

- **Step 1 — Dependency check (AC-F2).** Runs before anything else:
  ```bash
  PY=$(command -v python3 || command -v python || echo "")
  [ -z "$PY" ] && echo "DEP_MISSING: python" || "$PY" -c "import sys; assert sys.version_info >= (3, 10), 'python>=3.10'; import matplotlib, yaml" 2>&1 || echo "DEP_MISSING"
  ```
  On `DEP_MISSING`, print the following and stop with nothing written:
  > "Python 3.10+ with matplotlib and pyyaml is needed: `pip install matplotlib pyyaml`"

  (It names the missing piece.)
- **Steps R0–R3 — `--spec <file>`.**
  - R0: run `arch-spec-scan.cjs --secrets --hosts <file>`. A secret match gives `❌ BLOCKED — secret pattern ({label}) at spec line N`, stop. Otherwise show the host table, then the Write Gate prompt naming `docs/images/{basename}-architecture.png`. Nothing is rendered until the developer approves.
  - R1: render to that path with `--check`.
  - R2: on exit 1, show the `spec error:` / `check:` lines.
  - R3: show the PNG with the Read tool.
- **Hard Rules:**
  - never edit `scripts/architecture-diagram.py` from a target project
  - never add Python packages to the target's dependency files

---

## Tests — tests/architecture-diagram.test.cjs

```js
const PY = resolvePython();   // ARCH_DIAGRAM_PYTHON env → python3 → python; 'none' forces absence
const HAVE_PY = PY && spawnSync(PY, ['-c', 'import matplotlib, yaml']).status === 0;
const pyDescribe = HAVE_PY ? describe : describe.skip;
if (!HAVE_PY) console.log('architecture-diagram: skipped — python/matplotlib not found');   // AC-NF3

pyDescribe('architecture-diagram.py', () => { /* P-U1..P-U5, N-U1..N-U4 below */ });
describe('AC-F13 allow-list', () => { /* runs without Python */ });
```

Renders go to `fs.mkdtempSync(os.tmpdir())`. Each render case has a 60 s timeout (ADO-90 measured 7–18 s).

---

## Domain Exceptions — app/exceptions.py
Not applicable. This story has no FastAPI application. The script's only error type is the existing `SpecError` → `spec error:` line → exit 1.

## Dependency Wiring — app/dependencies.py
Not applicable. No FastAPI application.

## FastAPI Router — app/routers/{feature}.py
Not applicable. No HTTP endpoints.

## Pydantic Schemas — app/schemas/{feature}_schema.py
Not applicable. Spec validation stays in `build()` (ADO-90), which reports a one-line `spec error:`.

## Service Layer — app/services/{feature}_service.py
Not applicable. No FastAPI application.

## Repository Layer — app/repositories/{feature}_repository.py
Not applicable. No persistence.

---

## API Changes

No HTTP API changes. The CLI contract above is the only interface, and it is additive (`--check`, `todo`).

### DB / persistence changes

No DB changes in this story.

---

## Auth & Security

No endpoints, auth or CORS.

| Location | Concern | Mitigation |
|---|---|---|
| Spec loading | Arbitrary object construction | `yaml.safe_load` / `json.load` only |
| Spec values in labels | Injection | Labels are drawn as matplotlib text; nothing is evaluated or executed |
| Example specs | Real names leaking | AC-F13 allow-list test |
| Scanner | False negatives on YAML secrets | `key: value` forms tested explicitly (N-U6, N-U7) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Spec mistake (unknown flow endpoint, duplicate id, bad `todo` value, …) | `spec error: <one line>`, exit 1, no PNG, no traceback |
| Unknown component type | Warning line; plain box with the spec `tag`; exit 0 |
| Router cannot find a path | Warning; straight-line fallback; `--check` reports `no clear path` and exits 1 |
| Python / matplotlib / pyyaml missing (skill) | Install message; stop; nothing written |
| Python missing (jest) | Renderer suite skipped with notice; allow-list and scanner suites still run |
| Scanner given a missing file | `arch-spec-scan: cannot read <path>`, exit 2 |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F3, AC-F14 | Move script; 12 presets; `todo` style; 5 examples | 2 |
| AC-F4 | `--check` (port the verifier, router fallbacks) | 1 |
| AC-F1, AC-F2, AC-F13, AC-NF3 | Scaffold, minimal skill, scanner, tests | 1 |
| **Total** | | **4** |

**Type: STORY slice of EPIC ADO-8001.**

---

## Definition of Done

**Implementation**
- [ ] `new-skill.sh` output committed, then edits applied
- [ ] All files in Files Changed present; `black --check scripts/architecture-diagram.py` clean
- [ ] No real names, hosts or IPs (AC-F13 test green)
- [ ] `.cjs` files carry the `SCRIPT REVIEW` header

**Quality**
- [ ] `npm test` green with Python; green with `ARCH_DIAGRAM_PYTHON=none` and the skip notice printed
- [ ] All 5 examples: `--check` → `check: ok`, exit 0
- [ ] Each example's PNG viewed: zone headings readable, unverified styling visible in `node-server.yaml`

**Review readiness**
- [ ] PR title: `[ADO-8001] /arch-diagram — Story 1: renderer, scanner and skill scaffold`
- [ ] PR description maps files to ACs (AC Coverage Matrix)

### Reviewer Checklist

**Security:**
- [ ] `yaml.safe_load` only; no subprocess or eval in the renderer
- [ ] Scanner patterns include YAML `key: value` forms; the tests prove it

**Compatibility:**
- [ ] ADO-90-format spec renders unchanged (P-U2)
- [ ] `todo` defaults to false; diagrams without it look identical to ADO-90

**AC coverage:**
- [ ] Every AC maps to a file; `# AC-Fx` tags present in the script and tests

**Regression:**
- [ ] Existing jest suites unaffected; `plugin.json` still valid JSON with one new skill entry

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None for this story | — | — | — |

---

## Request Flow

```
Developer: /arch-diagram --spec docs/architecture/diagram/my.arch.yaml
  → Step 1 dependency check ── missing → install message, stop (AC-F2)
  → R0 arch-spec-scan --secrets --hosts ── secret → ❌ BLOCKED, stop
       → host table + Write Gate prompt ── SKIP → stop, nothing written
  → R1 python scripts/architecture-diagram.py <spec> docs/images/my-architecture.png --check
       ├─ exit 0 → "check: ok" → R3 show PNG
       ├─ exit 1 + "spec error:" → show line, stop (no PNG)
       └─ exit 1 + "check:" lines → show problems + PNG (layout revision is Story 2)
```

---

## Rollback

Additive. Revert the Story 1 commit(s). `new-skill.sh`'s `plugin.json` and README edits revert with them. No target application is affected, because nothing has been deployed until a release.

---

## Handover

### QA Team
- With Python installed, run `npm test`. Then run `ARCH_DIAGRAM_PYTHON=none npm test` and confirm the skip notice and a green run.
- Open each example PNG.
- Introduce a hostname such as `db.corp.local` into a fixture copy, confirm the allow-list test fails, then revert.

### DevOps / Platform Team
- No pipeline change.
- Developer prerequisite: Python 3.10+, `pip install matplotlib pyyaml`.

### Future Developer — adding a preset
1. Add the entry to `TYPES`, reusing a family.
2. Add the type to the preset-grid test spec (P-U3).
3. Add a row to the evidence map (Story 2).

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | renderer | each of the 5 example specs, `--check` | exit 0, PNG > 10 KB, `check: ok`, no warnings | AC-F3, AC-F4 |
| P-U2 | renderer | ADO-90-format spec (no `todo`, names made up) | exit 0, no warnings | AC-F3 |
| P-U3 | renderer | spec with one component of each of the 12 new presets | exit 0, no "unknown type" warning | AC-F3 |
| P-U4 | renderer | `node-server.yaml` (has `todo: true` component and flow) | exit 0, no missing-glyph warning. A Python one-liner loads the module with `importlib` and calls `legend_entries(zones, flows)` (a pure function split out of `draw_legend`), and the result includes "Unverified (⚠ TODO)" | AC-F14 |
| P-U5 | renderer | spec without any `todo` | `legend_entries` has no "Unverified" entry | AC-F14 |
| P-U6 | `isDocHost` | `api.contoso.example.com`, `db.test`, `192.0.2.10`, `localhost` | true | AC-F13 |
| P-U7 | `extractHosts` | `server: sqlprod01` (dotless), `url: https://a.b.example.org/x` | both reported with line numbers | AC-F13 |
| P-U8 | allow-list | all files under `skills/arch-diagram/**` and `tests/fixtures/arch-diagram/**`, plus `scripts/architecture-diagram.py` and `scripts/arch-spec-scan.cjs` | every extracted host passes `isDocHost` (README / CHANGELOG rows are covered by the reviewer checklist) | AC-F13 |
| P-U9 | jest without Python | `ARCH_DIAGRAM_PYTHON=none` | renderer suite skipped; notice printed; run green | AC-NF3 |
| P-U11 | skill Step 1 | python ≥3.10, matplotlib and pyyaml all present | `DEP_MISSING` not printed; skill proceeds to the next step | AC-F2 |
| P-U12 | `scanSecrets` + `extractHosts` on stdin | clean spec piped via `--stdin` | exit 0; host list printed; no file created | AC-F7 |
| P-U10 | `scanSecrets` | spec with key names only (`DB_PASSWORD` listed as a name) | no findings | AC-F7 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | renderer `--check` | crowded spec (overlapping `span`, flow forced through a box) | exit 1; ≥1 `check:` problem line; summary `check: N problems` | AC-F4 |
| N-U2 | renderer | `todo: "yes"` | `spec error: todo must be true or false …`, exit 1, no PNG | AC-F14 |
| N-U3 | renderer | spec with unknown flow endpoint | `spec error:` line, exit 1, no traceback | AC-F3 |
| N-U4 | renderer | unknown type `mainframe` | warning, plain box, exit 0 | AC-F3 |
| N-U5 | `isDocHost` | `db.corp.local`, `10.1.2.3`, `app.example.net` | false | AC-F13 |
| N-U6 | `scanSecrets` | YAML `password: <runtime-built value>` | 1 finding, label `password`, correct line | AC-F7 |
| N-U7 | `scanSecrets` | YAML `client_secret: …` and `Server=x;Password=…`, both runtime-built | 2 findings | AC-F7 |
| N-U10 | `extractHosts` | prose `e.g.` / `i.e.`, `process.env.PORT`, `module.exports`, `yaml.safe_load`, `!GetAtt Db.Endpoint.Address` | not reported | AC-F13 |
| N-U14 | `extractHosts` strict | `orders.contoso.co.uk` inside a ```yaml fence in a `.md` file | reported; `isDocHost` false; allow-list test fails | AC-F13 |
| N-U11 | `scanSecrets` | `SESSION_SIGNING_SECRET=<runtime-built>` (prefixed key) | 1 finding | AC-F7 |
| N-U12 | skill `--spec` | hand-written spec with `server: <internal name>`, SKIP at the Write Gate prompt | host listed; no PNG written | AC-F1 |
| N-U13 | scaffold | re-run `new-skill.sh arch-diagram` after scaffold | `❌ skills/arch-diagram/ already exists`, exit 1, nothing changed | AC-F1 |
| N-U8 | `extractHosts` | `config.yaml`, `package.json`, `ecosystem.config.js` | not reported (file extensions) | AC-F13 |
| N-U9 | skill scenario | python absent / matplotlib absent / pyyaml absent | install message names the missing piece; no file written | AC-F2 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Scaffold | Run `new-skill.sh arch-diagram`; run plugin preflight | skill, stub, scenario, `plugin.json` entry and README row present; preflight green | AC-F1 |
| INT-2 | Hand-written spec | `/arch-diagram --spec skills/arch-diagram/references/examples/docker-compose.yaml` in a scratch repo | PNG written at the announced path; `check: ok`; PNG shown | AC-F1, AC-F4 |

> NF AC verification:
> AC-NF3 (suite passes without Python): verified by P-U9. Run `ARCH_DIAGRAM_PYTHON=none npm test` and confirm the notice "skipped — python/matplotlib not found" and exit 0. Also do one manual run with Python actually removed from `PATH` (`PATH=$(echo "$PATH" | tr ':' '\n' | grep -vi python | paste -sd:) npm test`), because the ICEA wording is "Python hidden from PATH".

---

### Revision Log
2026-11-13 — Critic pass 2 notes:
- `--stdin` added to the Files Changed row
- YAML fences scanned
- strict mode for ccTLDs (N-U14)

2026-11-13 — Critic revision 1:
- host extraction narrowed (URL / key / TLD-shaped / IPv4)
- `--stdin` added
- `--spec` mode scans and asks before rendering
- secret tests re-tagged AC-F7
- fake secrets built at runtime
- missing positive and negative rows added
- allow-list scope extended to the two scripts
- PATH-stripped run added

2026-11-13 — Story 1 spec drafted. AC-F1 and AC-F2 moved here from Story 2 because `new-skill.sh` must run before the examples are written into `skills/arch-diagram/`; `arch-spec-scan.cjs` added here because the AC-F13 test needs its host extraction.
