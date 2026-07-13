#!/usr/bin/env python3
"""
Plugin structural validator — run before every release.
Catches consistency errors that accumulate when files are edited independently.

Usage:
    python3 tests/validate.py          # from plugin root
    python3 tests/validate.py --strict # treat warnings as errors

Exit codes: 0 = pass, 1 = errors found
"""

import os, re, glob, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

errors = []
warnings = []
strict = "--strict" in sys.argv

def err(msg): errors.append(msg)
def warn(msg):
    if strict: errors.append(msg)
    else: warnings.append(msg)

# ── 1. Canonical stub list (derived from disk — self-maintaining) ─────────────
# The command-stubs directory is the source of truth for the deployable set.
# Deriving the list (rather than hardcoding it) means it can never fall behind
# disk again — the bootstrap STUB_FILES array (scripts/setup-init-bootstrap.cjs) and the
# setup-status report line must all agree with this count (checks below + check 35).
CANONICAL_STUBS = sorted(os.path.basename(p) for p in glob.glob("_project-deploy/commands/*.md"))
N = len(CANONICAL_STUBS)

ds = open("skills/setup-status/SKILL.md").read()
for stub in CANONICAL_STUBS:
    if stub not in ds:
        err(f"setup-status/SKILL.md: missing stub '{stub}' in check 1d loop")
if f"N/{N} stubs deployed" not in ds:
    err(f"setup-status/SKILL.md: report line should say 'N/{N} stubs deployed' (currently has wrong count)")

# Stub deployment moved from an inline setup-init.md list into the bootstrap script
# (scripts/setup-init-bootstrap.cjs, STUB_FILES array) — the deterministic refactor that
# replaced the mechanical setup-init/setup-sync steps. Validate the array covers every stub.
boot = open("scripts/setup-init-bootstrap.cjs").read()
for stub in CANONICAL_STUBS:
    if stub not in boot:
        err(f"setup-init-bootstrap.cjs: STUB_FILES missing stub '{stub}'")

# ── 2. No duplicate step numbers in icea-feature Codebase Orientation ─────────
icea = open("skills/icea-feature/SKILL.md").read()
orient = icea.split("## Execution Steps")[0].split("## Codebase Orientation")[-1]
nums = re.findall(r"^(\d+)\. ", orient, re.MULTILINE)
dupes = [n for n in set(nums) if nums.count(n) > 1]
if dupes:
    err(f"icea-feature/SKILL.md: duplicate step numbers {dupes} in Codebase Orientation — renumber")

# ── 3. plugin-readiness check count ────────────────────────────────────────────
pr = open("skills/plugin-readiness/SKILL.md").read()
for stale in ["12 setup-status", "All 12 ", "the 12 "]:
    if stale in pr:
        err(f"plugin-readiness/SKILL.md: stale count '{stale}' — update to match table row count")

# ── 4. architecture-deployment.md referenced everywhere it must be ─────────────
MUST_REFERENCE_DEPLOY = [
    "skills/setup-status/SKILL.md",
    "commands/session-start.md",
    "skills/icea-feature/SKILL.md",
    "skills/plugin-readiness/SKILL.md",
    "commands/setup-init.md",
]
for fpath in MUST_REFERENCE_DEPLOY:
    if "architecture-deployment" not in open(fpath).read():
        err(f"{fpath}: missing reference to 'architecture-deployment' — add check/read")

# ── 5. Stack contexts all read from architecture.md ───────────────────────────
STACK_SKILLS = [
    "skills/icea-feature/SKILL.md",
    "skills/icea-review/SKILL.md",
    "skills/pr-describe/SKILL.md",
    "skills/ado-tasks/SKILL.md",
]
for fpath in STACK_SKILLS:
    content = open(fpath).read()
    if "## Stack Context" in content:
        section = content.split("## Stack Context")[1][:300]
        if "architecture.md" not in section:
            err(f"{fpath}: Stack Context must reference architecture.md as primary source")

# ── 6. No inline B1-B7 lists — must reference shared spec ────────────────────
for fpath in glob.glob("commands/*.md") + glob.glob("skills/**/*.md", recursive=True):
    content = open(fpath).read()
    if re.search(r"^- B[1-7]:", content, re.MULTILINE):
        err(f"{fpath}: inline B1-B7 list — replace with load of skills/shared/business-context-severity.md")

# ── 7. Identity is centralised in .claude-plugin/config.json ──────────────────
# Organization / project / company must never be hardcoded in skills, commands, or
# their reference docs. Skills read org/project at runtime from CLAUDE.md §2 (seeded
# from config.json); illustrative docs use <your-org>/<your-project> placeholders.
CONFIG_PATH = ".claude-plugin/config.json"
if not os.path.exists(CONFIG_PATH):
    err(f"{CONFIG_PATH}: missing — the single source of truth for organization/project/company/repo identity")
    cfg_ident = {}
else:
    try:
        cfg_ident = json.load(open(CONFIG_PATH))
    except Exception as e:
        err(f"{CONFIG_PATH}: invalid JSON ({e})")
        cfg_ident = {}
    for k in ["company", "organization", "project", "adoBaseUrl", "pluginRepoName"]:
        if not cfg_ident.get(k):
            err(f"{CONFIG_PATH}: missing required key '{k}'")

# The plugin ships company-agnostic: the configured org is a placeholder ("your-org")
# until an install/rebrand sets a real one. Only enforce "no hardcoded real org" once a
# real org is configured — and never flag the "<your-org>" example placeholder itself.
org_slug = cfg_ident.get("organization", "")
_is_placeholder = (not org_slug) or org_slug.startswith("your-")
if not _is_placeholder:
    for fpath in glob.glob("skills/**/*.md", recursive=True) + glob.glob("commands/*.md"):
        if org_slug in open(fpath).read():
            err(f"{fpath}: hardcoded ADO org '{org_slug}' — read it at runtime from CLAUDE.md §2, "
                f"or use a <your-org> placeholder in examples (identity lives in {CONFIG_PATH})")

# 7b. Manifests must stay in sync with config.json (run scripts/sync-config.sh).
if cfg_ident:
    clone_url = f"{cfg_ident['adoBaseUrl']}/{cfg_ident['organization']}/{cfg_ident['project']}/_git/{cfg_ident['pluginRepoName']}"
    _pj = json.load(open(".claude-plugin/plugin.json"))
    if _pj.get("repository") != clone_url:
        err(f"plugin.json repository '{_pj.get('repository')}' != config-derived '{clone_url}' — run scripts/sync-config.sh")
    if _pj.get("author", {}).get("name") != cfg_ident["company"]:
        err(f"plugin.json author.name != config company '{cfg_ident['company']}' — run scripts/sync-config.sh")
    if os.path.exists(".claude-plugin/marketplace.json"):
        _mk = json.load(open(".claude-plugin/marketplace.json"))
        want = f"{cfg_ident['company']} internal Claude Code plugins"
        if _mk.get("description") != want:
            err(f"marketplace.json description != config-derived '{want}' — run scripts/sync-config.sh")

# ── 8. dream-health trigger uses hyphen not space ─────────────────────────────
dh = open("commands/dream-health.md").read()
if re.search(r"`/dream health`", dh):
    err("commands/dream-health.md: trigger should be '/dream-health' (hyphen), not '/dream health' (space)")

# ── 9. knowledge-graph schemas present + graph.json integrity (ADR 0038 / 0039) ──
# domain-map was retired in v3.0.0; the graph is the single orientation layer.
# graph.json (v3.3.0, ADR 0039) is the authoritative structure; the index + detail
# files are its projection.
for gs in ["skills/shared/graph-index-schema.md",
           "skills/shared/graph-module-schema.md",
           "skills/shared/graph-json-schema.md"]:
    if not os.path.exists(gs):
        err(f"{gs}: missing — the knowledge graph is the single orientation layer (ADR 0038/0039)")
if os.path.exists("skills/shared/domain-map-spec.md"):
    err("skills/shared/domain-map-spec.md still exists — it was retired in v3.0.0 (ADR 0038); remove it")

# 9a. Wiring: the generator (architect) and refresher (graph-sync) must reference the
# authoritative sidecar schema, or graph.json goes unmaintained.
for fpath in ["skills/architect/SKILL.md", "skills/graph-sync/SKILL.md"]:
    if os.path.exists(fpath) and "graph-json-schema" not in open(fpath).read():
        err(f"{fpath}: does not reference graph-json-schema.md — graph.json generation unwired (ADR 0039)")

# 9b. Self-contained graph.json integrity — dormant in the plugin repo (no graph.json),
# active when validate.py runs inside a consuming project. Guards the FAIR invariants:
# no orphans, no dangling edges, unique ids, index/detail projection agreement; cycles warn.
_GRAPH_JSON = ".claude/graph/graph.json"
if os.path.exists(_GRAPH_JSON):
    try:
        _g = json.load(open(_GRAPH_JSON))
    except Exception as e:
        err(f"{_GRAPH_JSON}: invalid JSON ({e})")
        _g = None
    if _g is not None:
        _nodes = _g.get("nodes", [])
        _edges = _g.get("edges", [])
        _ids = [n.get("id") for n in _nodes]
        _idset = set(_ids)
        # unique ids
        if len(_ids) != len(_idset):
            err(f"{_GRAPH_JSON}: duplicate node ids "
                f"{sorted({i for i in _ids if _ids.count(i) > 1})}")
        # moduleCount agreement
        if _g.get("meta", {}).get("moduleCount") != len(_nodes):
            err(f"{_GRAPH_JSON}: meta.moduleCount != nodes.length ({len(_nodes)})")
        # no dangling edges
        for e in _edges:
            for end in ("from", "to"):
                if e.get(end) not in _idset:
                    err(f"{_GRAPH_JSON}: dangling edge {end}='{e.get(end)}' resolves to no node")
        # projection agreement: a detail file exists for every node; index row count matches
        for n in _nodes:
            df = os.path.join(".claude", n.get("detailFile", ""))
            if not n.get("detailFile") or not os.path.exists(df):
                err(f"{_GRAPH_JSON}: node '{n.get('id')}' detailFile missing on disk ({df})")
        _idx = ".claude/graph/graph-index.md"
        if os.path.exists(_idx):
            _rows = len(re.findall(r"^\|\s*[A-Za-z]", open(_idx).read(), re.MULTILINE)) - 1  # minus header
            if _rows != len(_nodes):
                err(f"{_GRAPH_JSON}: index rows ({_rows}) != nodes ({len(_nodes)}) — projection drift")
        # cycles: warn only (bidirectional deps can be legitimate)
        _adj = {}
        for e in _edges:
            _adj.setdefault(e.get("from"), []).append(e.get("to"))
        _WHITE, _GRAY, _BLACK = 0, 1, 2
        _color = {i: _WHITE for i in _idset}
        def _dfs(u, path):
            _color[u] = _GRAY
            for v in _adj.get(u, []):
                if v not in _color:
                    continue
                if _color[v] == _GRAY:
                    warn(f"{_GRAPH_JSON}: dependency cycle {' → '.join(path + [u, v])} "
                         f"(not an error — allowlist if intended)")
                elif _color[v] == _WHITE:
                    _dfs(v, path + [u])
            _color[u] = _BLACK
        for _i in _idset:
            if _color[_i] == _WHITE:
                _dfs(_i, [])

# ── 10. source-file-consent table has all skills ─────────────────────────────
consent = open("skills/shared/source-file-consent.md").read()
MUST_BE_IN_CONSENT = [
    "pr-create","pr-describe","ado-tasks","sprint-metrics",
    "token-analysis","dream-rollback","architect","product-docs",
    "icea-feature","icea-review","session-start","setup-status",
]
for skill in MUST_BE_IN_CONSENT:
    if f"`{skill}`" not in consent and f"`/{skill}`" not in consent:
        err(f"source-file-consent.md: missing row for '{skill}'")

# ── 11. business-context-severity referenced in every SKILL.md ───────────────
for fpath in glob.glob("skills/*/SKILL.md"):
    if "business-context-severity" not in open(fpath).read():
        err(f"{fpath}: missing 'business-context-severity' reference")

# ── 12. No consecutive --- separators (outside YAML frontmatter) ─────────────
for fpath in (glob.glob("skills/**/*.md", recursive=True) + glob.glob("commands/*.md")):
    lines = open(fpath).readlines()
    in_fm, fm_done, prev_sep = True, False, False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not fm_done:
            if i == 0 and stripped == "---": continue
            if stripped == "---" and not fm_done: fm_done = True; continue
            continue
        if stripped == "---":
            if prev_sep:
                err(f"{fpath}: consecutive '---' at lines {i} and {i+1} — remove the extra one")
            prev_sep = True
        else:
            prev_sep = False

# ── 13. plugin.json skills match skills/ folders ─────────────────────────────
plugin = json.load(open(".claude-plugin/plugin.json"))
registered = set(plugin["components"]["skills"])
on_disk = set(os.path.basename(os.path.dirname(p)) for p in glob.glob("skills/*/SKILL.md"))
for s in registered - on_disk:
    err(f"plugin.json: skill '{s}' registered but skills/{s}/SKILL.md not found")
for s in on_disk - registered:
    err(f"plugin.json: skill '{s}' folder exists but not registered in components.skills")

# ── 14. Test scenarios — warn for missing (not error) ────────────────────────
existing_tests = set(os.path.splitext(f)[0] for f in os.listdir("tests/skill-scenarios") if f.endswith(".yaml"))
for skill in sorted(on_disk):
    if skill not in existing_tests:
        warn(f"tests/skill-scenarios/{skill}.yaml: no test scenario (write one before shipping)")

# ── 15. CHANGELOG version matches plugin.json ────────────────────────────────
plugin_version = plugin.get("version","")
changelog = open("CHANGELOG.md").read()
if plugin_version and f"[{plugin_version}]" not in changelog:
    err(f"CHANGELOG.md: missing entry for current plugin version [{plugin_version}]")

# ── 16. CLAUDE.md has plugin version line ────────────────────────────────────
claude_md = open("CLAUDE.md").read()
if "Plugin version:" not in claude_md:
    err("CLAUDE.md: missing 'Plugin version:' line — add it to the header")

# ── 17. Consent-category agreement (SKILL.md token ↔ source-file-consent table)
# The central spec table is the single source of truth. Each skill must declare a
# matching `Consent:` token in its metadata line. This check errors on any
# mismatch, any skill missing a token, any skill missing from the table, and any
# table row that names a skill which no longer exists.
CONSENT_SPEC = "skills/shared/source-file-consent.md"

def parse_consent(expr):
    """'C(internal,icea)|A(code-standalone)' -> {('C','internal'),('C','icea'),('A','code-standalone')}
       'C' -> {('C','default')}.  Returns None if the expression is malformed."""
    expr = expr.strip()
    pairs = set()
    for clause in expr.split("|"):
        m = re.fullmatch(r"\s*([ABC])(?:\(([^)]*)\))?\s*", clause)
        if not m:
            return None
        cat, ctxs = m.group(1), m.group(2)
        if ctxs is None:
            pairs.add((cat, "default"))
        else:
            for ctx in ctxs.split(","):
                ctx = ctx.strip()
                if not ctx:
                    return None
                pairs.add((cat, ctx))
    return pairs or None

# 17a. token from each SKILL.md metadata line
token_re = re.compile(r"·\s*Consent:\s*([^_]+?)\s*_")
skill_tokens = {}
for skill in sorted(on_disk):
    body = open(f"skills/{skill}/SKILL.md").read()
    m = token_re.search(body)
    if not m:
        err(f"skills/{skill}/SKILL.md: no 'Consent:' token in metadata line "
            f"(add '· Consent: <category>' per {CONSENT_SPEC})")
        continue
    parsed = parse_consent(m.group(1))
    if parsed is None:
        err(f"skills/{skill}/SKILL.md: malformed Consent token '{m.group(1).strip()}'")
        continue
    skill_tokens[skill] = parsed

# 17b. rows from the authoritative skill table in the consent spec.
# Scope strictly to the section that begins at the "| Skill | Consent | Gate"
# header and ends at the next markdown heading, so the Category A/B/C explainer
# tables and the command reference table are not mistaken for it.
consent_doc = open(CONSENT_SPEC).read()
spec_rows = {}
hdr = re.search(r"^\|\s*Skill\s*\|\s*Consent\s*\|.*$", consent_doc, re.MULTILINE)
if not hdr:
    err(f"{CONSENT_SPEC}: authoritative skill table not found "
        f"(expected a '| Skill | Consent | Gate applied at |' header)")
else:
    rest = consent_doc[hdr.end():]
    nxt = re.search(r"^#{2,3}\s", rest, re.MULTILINE)
    table = rest[:nxt.start()] if nxt else rest
    row_re = re.compile(r"^\|\s*`([a-z0-9-]+)`\s*\|\s*((?:\\\||[^|])+?)\s*\|", re.MULTILINE)
    for name, cat in row_re.findall(table):
        cat = cat.replace("\\|", "|").strip()      # un-escape markdown pipe
        parsed = parse_consent(cat)
        if parsed is None:
            err(f"{CONSENT_SPEC}: skill table row '{name}' has an unparseable "
                f"Consent value '{cat}'")
        else:
            spec_rows[name] = parsed

# 17c. compare the two sides
for skill, tok in skill_tokens.items():
    if skill not in spec_rows:
        err(f"{CONSENT_SPEC}: skill '{skill}' is missing from the authoritative "
            f"skill table (its SKILL.md declares Consent: present)")
    elif spec_rows[skill] != tok:
        err(f"consent mismatch for '{skill}': SKILL.md token {sorted(tok)} != "
            f"spec table {sorted(spec_rows[skill])}")
for name in spec_rows:
    if name not in on_disk:
        err(f"{CONSENT_SPEC}: skill table row '{name}' has no skills/{name}/ folder "
            f"(stale entry — remove or rename)")

# ── 18. Language coverage matrix ─────────────────────────────────────────────
# A language is only "supported" if it has the full set of pieces. This stops a
# language from being half-added: a rule file with no checker, or an architect
# stack with no template, etc. Each backend language declared by a rule file must
# have (a) a code-review checker reference and (b) at least one architect prompt
# + matching template folder. Frontend/other rule files are exempt from the
# architect-stack requirement (declared in FRONTEND_RULES) but still need a checker
# if they introduce a distinct review language.
#
# Maintenance: when adding a language, add one row to LANGUAGE_MATRIX. The check
# then enforces that every referenced file actually exists.
LANGUAGE_MATRIX = {
    # language: (rule_file, checker_file, [architect_stack_dirs])
    # dotnet-rules.md renamed to csharp-dotnet-rules.md in 3.6.0 (ADR 0043)
    "dotnet": ("_project-deploy/rules/csharp-dotnet-rules.md",
               "skills/code-review/references/checkers-dotnet.md",
               ["dotnet-api", "aspnet-mvc", "aspnet-framework"]),
    # nodejs-rules.md renamed to nodejs-typescript-rules.md in 3.6.0 (ADR 0043)
    "typescript": ("_project-deploy/rules/nodejs-typescript-rules.md",
                   "skills/code-review/references/checkers-typescript.md",
                   ["js-library"]),
    "java": ("_project-deploy/rules/java-rules.md",
             "skills/code-review/references/checkers-java.md",
             ["spring-boot"]),
    "python": ("_project-deploy/rules/python-rules.md",
               "skills/code-review/references/checkers-python.md",
               ["python-fastapi", "python-django", "python-flask"]),
}
# Rule files that don't map to a backend language triple (checker + architect stack):
# frontend frameworks, cross-cutting languages, styling, testing, API/RPC, database,
# backend-concern layers, and legacy maintenance rules (ADR 0043 layered organisation).
# Adding a new rule file still requires a conscious decision — LANGUAGE_MATRIX or here.
# (dotnet-framework-rules.md renamed to csharp-framework48-rules.md in 3.6.0 — ADR 0043.)
EXEMPT_RULES = {
    # universal + frontend frameworks
    "_project-deploy/rules/project-rules.md", "_project-deploy/rules/angular-rules.md", "_project-deploy/rules/react-ecosystem-rules.md",
    "_project-deploy/rules/vue-ecosystem-rules.md", "_project-deploy/rules/svelte-ecosystem-rules.md",
    "_project-deploy/rules/solid-ecosystem-rules.md", "_project-deploy/rules/nextjs-ecosystem-rules.md",
    "_project-deploy/rules/nuxt-ecosystem-rules.md", "_project-deploy/rules/remix-ecosystem-rules.md",
    "_project-deploy/rules/astro-ecosystem-rules.md",
    # cross-cutting languages + styling
    "_project-deploy/rules/typescript-rules.md", "_project-deploy/rules/javascript-rules.md", "_project-deploy/rules/tailwind-rules.md",
    "_project-deploy/rules/css-rules.md", "_project-deploy/rules/sass-rules.md", "_project-deploy/rules/css-modules-rules.md",
    # API / RPC / data-access clients + ORM
    "_project-deploy/rules/graphql-client-rules.md", "_project-deploy/rules/graphql-server-rules.md",
    "_project-deploy/rules/trpc-rules.md", "_project-deploy/rules/rest-client-rules.md", "_project-deploy/rules/rest-api-rules.md",
    "_project-deploy/rules/prisma-drizzle-rules.md",
    # backend concern layers (language-agnostic)
    "_project-deploy/rules/backend-base-rules.md", "_project-deploy/rules/data-access-rules.md",
    "_project-deploy/rules/sql-relational-rules.md", "_project-deploy/rules/auth-rules.md", "_project-deploy/rules/api-security-rules.md",
    "_project-deploy/rules/testing-backend-rules.md", "_project-deploy/rules/observability-rules.md", "_project-deploy/rules/caching-rules.md",
    # databases
    "_project-deploy/rules/postgresql-rules.md", "_project-deploy/rules/sql-server-rules.md", "_project-deploy/rules/nosql-document-rules.md",
    # e2e testing
    "_project-deploy/rules/playwright-rules.md", "_project-deploy/rules/cypress-rules.md",
    # legacy / maintenance-only (.NET Framework era)
    "_project-deploy/rules/csharp-framework48-rules.md", "_project-deploy/rules/wcf-rules.md", "_project-deploy/rules/ef6-rules.md",
    "_project-deploy/rules/ado-net-legacy-rules.md",
}

for lang, (rule_f, checker_f, stacks) in LANGUAGE_MATRIX.items():
    if not os.path.exists(rule_f):
        err(f"language '{lang}': declared in matrix but rule file {rule_f} is missing")
    if not os.path.exists(checker_f):
        err(f"language '{lang}': rule file exists but code-review checker "
            f"{checker_f} is missing (half-added language)")
    for stack in stacks:
        prompt = f"skills/architect/prompts/{stack}.md"
        tmpl = f"skills/architect/templates/{stack}"
        if not os.path.exists(prompt):
            err(f"language '{lang}': architect prompt {prompt} is missing")
        if not os.path.isdir(tmpl):
            err(f"language '{lang}': architect template folder {tmpl}/ is missing")
        else:
            # Templates are composed at deploy time from two tiers (ADR — architect
            # template dedup): a stack-agnostic skills/architect/templates/_shared/
            # base (decisions/integrations/security/data) plus per-stack files that
            # add stack-specifics and override shared files. Only architecture.md and
            # architecture-deployment.md are guaranteed to live in the stack folder;
            # the rest may be inherited from _shared/. See validate.js for the full
            # compose-completeness (union == 8 files) assertion.
            if not os.path.exists(f"{tmpl}/architecture.md"):
                err(f"language '{lang}': {tmpl}/architecture.md is missing")
            if not os.path.exists(f"{tmpl}/architecture-deployment.md"):
                err(f"language '{lang}': {tmpl}/architecture-deployment.md is missing")
            # Compose completeness: union(_shared, stack) must resolve to 8 files.
            shared_dir = "skills/architect/templates/_shared"
            shared_md = set(f for f in os.listdir(shared_dir) if f.endswith(".md")) if os.path.isdir(shared_dir) else set()
            stack_md = set(f for f in os.listdir(tmpl) if f.endswith(".md"))
            composed = shared_md | stack_md
            if len(composed) != 8:
                err(f"language '{lang}': {tmpl} composes to {len(composed)} files, expected 8 "
                    f"(union with _shared/): {sorted(composed)}")

# Reverse: any backend rule file present but not in the matrix is a half-added language
all_rule_files = set(glob.glob("_project-deploy/rules/*.md"))
matrix_rule_files = {v[0] for v in LANGUAGE_MATRIX.values()} | EXEMPT_RULES
for rf in sorted(all_rule_files - matrix_rule_files):
    warn(f"rule file {rf} is not covered by the language matrix or FRONTEND_RULES "
         f"(add it so coverage is enforced)")

# ── 19. Version consistency across plugin.json / CLAUDE.md / CHANGELOG ────────
import re as _re
pj_ver = plugin_version  # already loaded above
cm = open("CLAUDE.md").read()
cm_match = _re.search(r"Plugin version:\s*([\d.]+)", cm)
if cm_match:
    if cm_match.group(1) != pj_ver:
        err(f"Version mismatch: plugin.json={pj_ver} but CLAUDE.md says {cm_match.group(1)}")
else:
    warn("CLAUDE.md: no 'Plugin version:' line found")

cl = open("CHANGELOG.md").read()
if f"[{pj_ver}]" not in cl:
    err(f"CHANGELOG.md: no entry for version [{pj_ver}] — add one before release")

# ── 20. Shared spec registration — every skills/shared/*.md in plugin.json ────
shared_files = {os.path.splitext(f)[0] for f in os.listdir("skills/shared")
                if f.endswith(".md") and f != "README.md"}
pj = json.load(open(".claude-plugin/plugin.json"))
registered_shared = set(pj.get("components", {}).get("shared", []))
for sf in sorted(shared_files - registered_shared):
    err(f"plugin.json: shared spec '{sf}' exists in skills/shared/ but is not in "
        f"components.shared array")
for rs in sorted(registered_shared - shared_files):
    err(f"plugin.json: components.shared lists '{rs}' but skills/shared/{rs}.md does not exist")

# ── 21. Scan skills must delegate Rule 5 to dismissed-findings-reconciliation ──
SCAN_SKILLS = ["code-review", "security", "dynamic-scan"]
for skill in SCAN_SKILLS:
    skill_path = f"skills/{skill}/SKILL.md"
    cmd_path   = f"commands/{skill}.md" if skill == "code-review" else None
    paths_to_check = [p for p in [skill_path, cmd_path] if p and os.path.exists(p)]
    found = any("dismissed-findings-reconciliation" in open(p).read() for p in paths_to_check)
    if not found:
        err(f"{skill}: no reference to 'dismissed-findings-reconciliation' found — "
            f"scan skills must delegate Rule 5 to skills/shared/dismissed-findings-reconciliation.md")

# ── 22. README skills table covers all plugin.json skills ─────────────────────
readme = open("README.md").read()
for skill in pj.get("components", {}).get("skills", []):
    if f"| `{skill}`" not in readme and f"`{skill}` |" not in readme:
        warn(f"README.md: skill '{skill}' is in plugin.json but has no row in the skills table")

# ── 23. README commands table covers all plugin.json commands ─────────────────
for cmd in pj.get("components", {}).get("commands", []):
    if cmd not in readme:
        warn(f"README.md: command '{cmd}' is in plugin.json but not mentioned in README")

# ── 24. No hardcoded ADO project values in commands/ ─────────────────────────
for cmd_file in sorted(glob.glob("commands/*.md")):
    content = open(cmd_file).read()
    # Look for hardcoded project name patterns: TeamProject = 'KE' or similar
    if _re.search(r"TeamProject\]\s*=\s*'[A-Z]{1,6}'", content):
        err(f"{cmd_file}: contains a hardcoded ADO TeamProject value — "
            f"read ADO_PROJECT dynamically from CLAUDE.md instead")

# ── 25. Consent token coverage for commands (warning only) ───────────────────
for cmd_file in sorted(glob.glob("commands/*.md")):
    content = open(cmd_file).read()
    # Commands that read source files should declare it; warn if they open source
    # without a consent note. Heuristic: looks for file reads beyond architecture docs.
    if "Consent:" not in content and "source-file-consent" not in content:
        if _re.search(r"cat\s+src/|open.*\.cs|open.*\.ts|open.*\.py|open.*\.java", content):
            warn(f"{cmd_file}: reads source files but has no Consent reference — "
                 f"add a reference to skills/shared/source-file-consent.md")

# ── 26. Spec purity — shared specs must stay tool-agnostic ────────────────────
# The durable assets are the specs (ICEA format, ledger schemas, consent model,
# gate logic). They remain portable only if they never reference Claude Code
# mechanics. Volatile wiring (stubs, CLAUDE.md, settings) is allowed to couple;
# skills/shared/ is not. See docs/adr/0003 and the vendor-coupling analysis.
CLAUDE_CODE_MECHANICS = [
    "settings.local.json", ".claude/settings", "command-stubs",
    "PreToolUse", "PostToolUse", "/permissions", "claude mcp",
]
for sf in sorted(glob.glob("skills/shared/*.md")):
    if os.path.basename(sf) == "README.md":
        continue
    content = open(sf).read()
    for mech in CLAUDE_CODE_MECHANICS:
        if mech in content:
            err(f"{sf}: references Claude Code mechanic '{mech}' — shared specs "
                 f"should stay tool-agnostic (durable layer); move tool wiring to "
                 f"the skill or command that consumes this spec")

# ── 27. Hooks present and executable bits documented ──────────────────────────
# graph-stale-detect.sh is deployed as the git post-merge/post-checkout hook by
# setup-init (Step 7b-4); it must exist here or /setup-init fails when it tries to copy it.
for hook in ["hooks/icea-floor.sh", "hooks/findings-gate-precommit.sh",
             "hooks/validate-ledgers.py", "hooks/validate-pr-compliance.py",
             "hooks/graph-stale-detect.sh", "hooks/README.md"]:
    if not os.path.exists(hook):
        err(f"missing {hook} — mechanical enforcement floor incomplete (ADR 0005)")

# ── 28. ADR index matches directory ───────────────────────────────────────────
if os.path.isdir("docs/adr"):
    adr_files = {f for f in os.listdir("docs/adr") if re.match(r"\d{4}-", f)}
    adr_index = open("docs/adr/README.md").read() if os.path.exists("docs/adr/README.md") else ""
    for af in sorted(adr_files):
        num = af.split("-")[0]
        if num not in adr_index:
            warn(f"docs/adr/{af}: not listed in docs/adr/README.md index")
else:
    err("docs/adr/ missing — decision records are the bus-factor insurance (ADR 0008)")

# ── 29. Guide version contract ────────────────────────────────────────────────
# Every guide carries a machine-readable stamp: <!-- documents-plugin-version: X.Y.Z -->
# A guide more than one MINOR version behind plugin.json is an error (release
# blocker); exactly one minor behind is a warning (update this release).
GUIDES = ["user-guide.html", "plugin-guide.html"]
def minor_of(v):
    parts = v.split(".")
    return (int(parts[0]), int(parts[1]))

pj_minor = minor_of(pj_ver)
for guide in GUIDES:
    if not os.path.exists(guide):
        warn(f"{guide}: guide file missing")
        continue
    head = open(guide).read(2000)
    gm = _re.search(r"documents-plugin-version:\s*([\d.]+)", head)
    if not gm:
        err(f"{guide}: missing '<!-- documents-plugin-version: X.Y.Z -->' stamp "
            f"in first 2000 chars — guides must declare what version they document")
        continue
    g_minor = minor_of(gm.group(1))
    gap = (pj_minor[0] - g_minor[0]) * 100 + (pj_minor[1] - g_minor[1])
    if gap > 1:
        err(f"{guide}: documents v{gm.group(1)} but plugin is v{pj_ver} "
            f"({gap} minor versions stale) — update the guide and its stamp before release")
    elif gap == 1:
        warn(f"{guide}: documents v{gm.group(1)}, plugin is v{pj_ver} — "
             f"one minor behind; update this release")

# ── 30. Guide content coverage ────────────────────────────────────────────────
# Every command in plugin.json must be mentioned in the user guide; every shared
# spec must be mentioned in the plugin guide. Coarse but catches whole-feature
# documentation gaps (e.g. /dismiss shipping with zero guide coverage).
if os.path.exists("user-guide.html"):
    ug = open("user-guide.html").read().lower()
    for cmd in pj.get("components", {}).get("commands", []):
        if cmd.lower() not in ug:
            warn(f"user-guide.html: command '{cmd}' not mentioned — "
                 f"users cannot discover undocumented commands")
if os.path.exists("plugin-guide-v9.html"):
    pg = open("plugin-guide-v9.html").read().lower()
    for spec in pj.get("components", {}).get("shared", []):
        if spec.lower() not in pg and spec.replace("-", " ").lower() not in pg:
            warn(f"plugin-guide-v9.html: shared spec '{spec}' not mentioned — "
                 f"architecture documentation incomplete")

# ── 35. Commands manifest ↔ disk + stub coverage (drift guard) ───────────────
# The plugin's own manifest must mirror commands/ exactly, every command must
# ship a deploy stub, and every stub named in a deploy loop must exist as a file.
# Guards the v2.6.x drift this check was added for: the icea-*/pr-* commands had
# fallen out of components.commands, and graph-sync.md was named in a deploy loop
# with no stub file behind it (so /graph-sync never deployed into projects).
cmd_disk = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob("commands/*.md")}
cmd_registered = set(pj["components"]["commands"])
for c in sorted(cmd_registered - cmd_disk):
    err(f"plugin.json: command '{c}' registered but commands/{c}.md not found")
for c in sorted(cmd_disk - cmd_registered):
    err(f"plugin.json: commands/{c}.md exists but is not in components.commands")

stub_disk = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob("_project-deploy/commands/*.md")}
for c in sorted(cmd_disk - stub_disk):
    err(f"_project-deploy/commands/{c}.md missing — /{c} will not deploy via setup-init/setup-sync")
for s in sorted(stub_disk - cmd_disk):
    warn(f"_project-deploy/commands/{s}.md has no matching commands/{s}.md (orphan stub)")

# Every stub filename named in the bootstrap's STUB_FILES array must have a real stub file.
# (Deploy logic moved from shell loops in setup-init.md / setup-sync into the bootstrap
# script; setup-sync now calls that same script in --mode sync.)
_boot = open("scripts/setup-init-bootstrap.cjs").read()
_arr = re.search(r"const STUB_FILES\s*=\s*\[(.*?)\]", _boot, re.DOTALL)
if not _arr:
    err("scripts/setup-init-bootstrap.cjs: could not locate the STUB_FILES array")
else:
    for tok in re.findall(r"[a-z0-9][a-z0-9-]*\.md", _arr.group(1)):
        if not os.path.exists(f"_project-deploy/commands/{tok}"):
            err(f"setup-init-bootstrap.cjs: STUB_FILES names '{tok}' but _project-deploy/commands/{tok} does not exist")

# ── Report ────────────────────────────────────────────────────────────────────
print(f"\n{'='*64}")
print(f"Plugin structural validation — v{plugin_version}")
print(f"  Errors  : {len(errors)}")
print(f"  Warnings: {len(warnings)}")
print(f"{'='*64}")

if errors:
    print("\nERRORS — must fix before release:")
    for e in errors: print(f"  ✗ {e}")

if warnings:
    print("\nWARNINGS — address before next major release:")
    for w in warnings: print(f"  ⚠ {w}")

if not errors:
    print("\n✅ All structural checks passed.")

sys.exit(1 if errors else 0)


# ── 31. Phase D wiring + capability-profile location (fault 1 guard) ─────────
if os.path.exists("skills/shared/phase-d-spec.md"):
    cr = open("commands/code-review.md").read()
    if "phase-d-spec" not in cr:
        err("commands/code-review.md: does not reference phase-d-spec.md — Phase D unwired")
    if "## Baseline" not in cr:
        err("commands/code-review.md: ledger structure missing '## Baseline' section (fault 2 guard)")
    # No committed file may contain machine capability claims
    for committed in ["skills/architect/SKILL.md"]:
        pass  # policy text allowed; the hard guard is on the deployment doc template:
    for tmpl in glob.glob("skills/architect/templates/**/architecture-deployment.md", recursive=True):
        if '"phaseD"' in open(tmpl).read():
            err(f"{tmpl}: contains phaseD capability block — capability claims are "
                f"machine-local (settings.local.json), never committed (phase-d-spec §1)")
else:
    warn("skills/shared/phase-d-spec.md missing — Phase D layer not present")

# ── 32. webconfig checker present when dotnet-framework rules exist ──────────
if os.path.exists("rules/dotnet-framework-rules.md"):
    if not os.path.exists("skills/code-review/references/webconfig-checks.md"):
        err("dotnet-framework stack supported but webconfig-checks.md missing — "
            "config-level checks are the legacy workhorse")

# ── 33. ICEA-D + manifest wiring ──────────────────────────────────────────────
if os.path.exists("skills/shared/icea-decisions-spec.md"):
    icea = open("skills/icea-feature/SKILL.md").read()
    for ref, label in [("icea-decisions-spec", "D block"), ("change-manifest-spec", "change manifest")]:
        if ref not in icea:
            err(f"skills/icea-feature/SKILL.md: does not reference {ref}.md — {label} unwired")
    ck = open("commands/checkin.md").read()
    if "change-manifest-spec" not in ck:
        err("commands/checkin.md: manifest delta measurement unwired")
    cr = open("skills/critic/SKILL.md").read()
    if "icea-decisions-spec" not in cr:
        err("skills/critic/SKILL.md: anti-strawman / D-fidelity checks unwired")

# ── 34. ADR coverage — every shared spec must have a governing ADR ────────────
if os.path.isdir("docs/adr"):
    adr_content = ""
    for f in os.listdir("docs/adr"):
        if f.endswith(".md") and f != "README.md":
            adr_content += open(f"docs/adr/{f}").read().lower()
    for sf in sorted(os.listdir("skills/shared")):
        if sf == "README.md" or not sf.endswith(".md"):
            continue
        name = sf.replace(".md", "")
        if name.lower() not in adr_content:
            warn(f"docs/adr/: shared spec '{name}' is not referenced in any ADR — "
                 f"decisions must be recorded (ADR 0008)")
