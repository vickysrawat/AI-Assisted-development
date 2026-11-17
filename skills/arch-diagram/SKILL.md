---
name: arch-diagram
description: >
  Draw an application's architecture / technical recovery diagram as a PNG, on any hosting
  model (Kubernetes, Docker, Node.js or Linux servers, Azure or AWS, on-prem IIS).
  `/arch-diagram` reads the repository's architecture documents and deployment files, drafts a
  diagram spec in which every box and arrow cites the file it came from (or is marked ⚠ TODO),
  scans it for secrets and hostnames, and renders it after the developer approves.
  `/arch-diagram --refresh` re-reads the evidence and shows what changed, keeping every item the
  developer marked `# manual`. `/arch-diagram --spec <file>` renders a spec the developer already has.
  Triggered by the /arch-diagram command and the ARCH DIAGRAM / ARCH DIAGRAM --refresh keywords.
  Trigger on: "draw the architecture diagram", "generate the recovery diagram",
  "architecture diagram from the codebase", "render the recovery diagram",
  "refresh the architecture diagram", "update the recovery diagram".
---
_Skill version: 1.0 · Last changed: 2026-11-16 · Plugin compatibility: ≥3.27.0 · Consent: B_

## Model routing

This skill uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{ "env": { "INFRA_MODEL": "claude-opus-4-8" } }` in `.claude/settings.json`.
See `../shared/model-routing-spec.md` for the full specification.

---

## Purpose

Produces the diagram a DR plan, runbook or go-live review asks for, from evidence in the
repository, with no hand-drawn layout and no hand-written spec. The LLM reads and decides;
two plugin scripts do the deterministic work:
- `scripts/arch-spec-scan.cjs` checks the draft: secrets, hostnames, and a source on every item
- `scripts/architecture-diagram.py` sizes the boxes, routes the arrows, draws the PNG and
  checks the layout (`--check`)

What it does NOT do:
- It never invents a component, zone or flow. No evidence means `⚠ TODO` + `todo: true`.
- It never copies a secret value. Settings files are read for key **names** only, and `.env`
  is never opened.
- It never writes into the repository before the developer approves, and never writes outside
  `docs/architecture/diagram/` and `docs/images/` in it. The only other file is the Step 6
  scratch draft in the OS temp folder, deleted by the command that scans it.
- It never edits `scripts/architecture-diagram.py`, never adds Python packages to the target's
  dependency files, and never runs anything from the target repository.
- It does not parse manifests in code. The LLM reads them, guided by `references/evidence-map.md`.

References: `references/app-identity.md` (name), `references/evidence-map.md` (what to read),
`references/spec-format.md` (what to write), `references/examples/` (hand-written specs).

---

## Step 0 — Parse arguments

| Argument | Mode |
|---|---|
| none | Generate (Steps 1, 1a, 2–10) |
| `--spec <file>` | Render a hand-written spec (Steps 1, R0–R3) |
| `--refresh` | Refresh the saved spec (Steps 1, F1–F5) |

Resolve `PLUGIN_DIR` from `.claude/plugin-path.txt` (if absent, use the Node.js resolver in
`../shared/plugin-path-resolution.md §1a`).

---

## Step 1 — Dependency check (AC-F2)

Run before anything else. Nothing in the repository is read until this passes.
Each candidate is tried in turn, because the first `python3` on PATH can be a stub that only
prints "Python was not found" (Windows Store alias).

```bash
PY=""
for c in python3 python py; do
  "$c" -c "import sys; assert sys.version_info >= (3, 10)" >/dev/null 2>&1 && PY="$(command -v "$c")" && break
done
if [ -z "$PY" ]; then
  echo "DEP_MISSING: python>=3.10"
else
  "$PY" -c "import matplotlib" >/dev/null 2>&1 || echo "DEP_MISSING: matplotlib"
  "$PY" -c "import yaml" >/dev/null 2>&1 || echo "DEP_MISSING: pyyaml"
  echo "PY=$PY"
fi
```

Each Bash call starts a fresh shell, so note the printed `PY=…` path and use it literally in
the render steps (Step 9, Step R1).

On any `DEP_MISSING` line, stop. Write nothing, and show this message with the missing pieces
named:
```
⛔ /arch-diagram needs Python 3.10+ with matplotlib and pyyaml.
   Missing: {python | python>=3.10 | matplotlib | pyyaml}
   Install: pip install matplotlib pyyaml
   These are tools on your machine only; do not add them to the application's requirements.
```

---

## Step 1a — Existing spec (AC-F8)

If `docs/architecture/diagram/*.arch.yaml` already exists, stop:
```
A spec already exists at {path}.
Run /arch-diagram --refresh to update it, or reply OVERWRITE to start again.
```
Continue only on `OVERWRITE`. The existing file is replaced only at Step 8, after approval.

---

## Step 2 — Application identity (AC-F12)

Follow `references/app-identity.md`: architecture title → `CLAUDE.md` project name → manifest
name → folder name. Print:
```
Application: {name} (from {source})
```
Derive the title (`{Name} — Architecture & Recovery`), the slug and both output paths from it.

---

## Step 3 — Collect evidence (AC-F5, AC-F7, AC-NF2)

**3a — Find candidate files (no reads yet).** For each row of `references/evidence-map.md`, run
its globs, matching file names **case-insensitively** (`Web.config` and `web.config` are the
same file type). Drop anything under the excluded folders, or ignored by `.gitignore` (or
`.tfignore` in a TFVC repository). Group the matches by role, and keep at most
`MAX_FILES_PER_ROLE` (15) per role, in the order the map's read budget sets: production paths
first, then glob priority, then shortest path. Everything else goes on the **Skipped (cap)** list.

The Glob tool walks `node_modules` and can time out on large repositories. If it does, use the
pruned search in `references/evidence-map.md` § Searching large repositories instead.

**3b — Ask before reading (Category B, `../shared/source-file-consent.md`).** Step 2 has
already read `CLAUDE.md`, the architecture title and the root manifest for the name only. Those
are project configuration, not application source. Before reading anything else, show one
bulk-scan prompt:
```
📂 Evidence scan request — /arch-diagram

  Files      : {N} ({count} per role: host · runtime · proxy · data · identity · config · pipeline · monitoring)
               architecture docs {n} · deployment / IaC / pipeline files {n} · settings templates {n} (key names only)
  Source     : {n} application source files, for listen ports only: {paths}   ← omit the line if none
  Skipped    : {n} over the per-role cap (listed in the summary)
  Why        : the diagram must show only what these files prove; each box will cite its file and line
  Looking for: hosts, runtimes, proxies, data stores, identity, pipelines, monitoring and the flows between them
  Never read : .env and other secret files; values in settings templates
  Token cost : ~{total lines of the files to read × 10} tokens estimated

Scan these files? (yes / no / skip source files / tell me which ones)
```
Wait for the reply. On `no`, stop. On `skip source files`, continue without them and mark the
facts they would have given (for example a listen port) as `⚠ TODO`.

**3c — Read.**
- Architecture documents and runbook / DR documents: read in full; cite by line.
- Deployment, IaC and pipeline files: read in full; cite by line.
- Settings templates (keys-only files): **do not open them.** Get the key names and line
  numbers from the scanner, which never prints values:
  ```bash
  node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --keys {template files}
  ```
  Cite a key as `# source: {template}:{line}`.
- Consent-gated source files: look only for the fact named (for example the port passed to
  `listen`).
- Kubernetes `Secret` manifests: `--keys` too (key names only); never read their `data:` values.
- Documents the skill cannot read (`.docx`, `.pdf`): list them in the summary as "not read", and
  cite them only as the reason for a `⚠ TODO` (for example
  `⚠ TODO: DR steps are in docs/…recovery-plan.docx, not readable`).
- If no `.claude/architecture/` folder (root or sub-project) has populated files, print:
  `no architecture docs — diagram drawn from code only; failover / backups ⚠ TODO`.

---

## Step 4 — Classify by role (AC-F5)

Map each piece of evidence to a role and a component type using the "Evidence → role → type"
column of `references/evidence-map.md`. Pick the zone template for the hosting model with
evidence from `references/spec-format.md`. Drop zones with nothing in them.

- **Documents count as evidence for hosting.** A statement such as "IIS on Windows Server
  (on-premises)" in an architecture document establishes the hosting model even when no
  deployment file does. Cite the document line.
- **Sources that disagree:** settle it with these rules, in order, and cite the source you kept:
  1. What is deployed beats what is described. A manifest, IaC file, pipeline or config file in
     the repository beats a document, **for the same environment**: a UAT manifest does not
     override a document about production, and a file that marks itself out of date loses as
     in rule 3.
  2. A file that exists beats a document naming a file that does not (for example a document
     mentions `deploy-prod.yml`, but the repository has `deploy.yml`).
  3. Between documents, the one that is newer (by its own date, else `git log`) beats the older.
     A document that marks itself as out of date ("UAT only", "not yet aligned", "draft",
     "superseded") loses to one that does not.
  4. Only if none of these settles it, or a document names two options ("on-premises or Azure
     VM"), draw the item once with `todo: true` and a detail that names both, citing both
     sources. Do not pick one.

  List every contradiction you settled in the TODO summary as "settled: {kept} over {dropped}
  ({rule})", so the developer can check it.
- **Several applications in one repository:** one runtime box per application inside the shared
  host (or one host per application when they deploy separately), each with its own source.
- **Mounts and references are flows too:** a ConfigMap, Secret or volume mounted into a pod, a
  Key Vault reference, or a config file loaded at start becomes a flow from the config item to
  its consumer, cited at the mount line.

If no hosting row has evidence, use one `server` box named after the application with
`todo: true` and `details: ["⚠ TODO: hosting not found — searched: {globs}"]`.

---

## Step 5 — Draft the spec in memory (AC-F6, AC-F14)

Write the spec following `references/spec-format.md`:
- one item per line or block
- `# source: path[:line]` at the end of every item's first line (code or document)
- no evidence → `todo: true` plus a `⚠ TODO: {what is unknown}` detail
- names, never values

Build the **TODO summary**: one line per `⚠ TODO`, saying what evidence would resolve it.
Do not write the draft into the repository (Step 6 uses a scratch file outside it).

---

## Step 6 — Check the draft (AC-F6, AC-F7)

Write the draft to a scratch file **in the OS temp folder, outside the repository**, scan it,
and delete it in the same command:
```bash
node -p "require('os').tmpdir().split(require('path').sep).join('/')"   # once: {tmp folder}
```
`{tmp draft}` is `{tmp folder}/arch-diagram-draft-{slug}-{4 random letters}.yaml`, so two runs
never share a file. Write the draft there with the Write tool, then:
```bash
node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --secrets --hosts --sources --root=. --json "{tmp draft}"; s=$?; rm -f "{tmp draft}"; exit $s
```
- The scanner's exit code is kept (0 clean, 1 findings, 2 could not read). No JSON on stdout is
  a failure, never a clean result.
- If the scan command did not run (denied, interrupted, timed out), delete `{tmp draft}` before
  doing anything else, and start Step 6 again.
Alternative when the shell handles it: pipe the draft from memory with a quoted heredoc
(`--stdin … <<'ARCH_DIAGRAM_DRAFT_EOF'`). Heredocs failed in some shells during verification, so
the temp file is the default.

Read the JSON report:
- **`secrets` not empty:** the draft holds a secret-looking value. Remove it from the draft (keep
  the key name if useful) and run Step 6 again. There is no approval path past a match. Never
  show the value. If it was prose, reword it.
- **`sources` not empty:** an item has no source, a `⚠ TODO` without `todo: true`, an inline
  list, or a cited file / line that does not exist. Fix the draft (correct the citation, or
  mark the item `⚠ TODO`) and run Step 6 again. Never show a draft with source gaps.
- **`hosts`:** list every host, server name and IP for Step 7, grouping spellings that differ
  only in case (`SQL01` / `sql01`) under the first one. They stay in the diagram exactly as
  found. The diagram must show the real names, and the skill never masks or renames them.

Never write the draft inside the repository before approval.

---

## Step 7 — Review (AC-F8, AC-F12)

Show, in this order:
1. `Application: {name} (from {source})`
2. The draft spec (YAML)
3. The TODO summary
4. The hosts in the diagram, for information:
   ```
   | Host / IP | Kind | Spec line |
   ```
   They are shown as found, so the developer knows which real names the PNG will carry.
5. The skipped-files list (cap, excluded, consent declined)

Then stop at the Write Gate:
```
📁 WRITE PENDING — reply APPROVE to write and render, or SKIP to discard.
   Spec:  docs/architecture/diagram/{slug}.arch.yaml
   Image: docs/images/{slug}-architecture.png
   Items: {n} with sources · {n} ⚠ TODO · hosts {n}

   You can also reply with a different name ("call it …") or edits.
```
- A name override re-derives the title, the slug and both paths. Nothing else changes.
- Edits change the draft, which goes through Step 6 again before being shown.
- `SKIP` ends the run with nothing written.

---

## Step 8 — Write the spec (AC-F8)

Only after `APPROVE`:
```bash
mkdir -p docs/architecture/diagram docs/images
```
Write the approved draft to `docs/architecture/diagram/{slug}.arch.yaml` with the Write tool.

## Step 9 — Render and check (AC-F8)

```bash
"{python path}" "$PLUGIN_DIR/scripts/architecture-diagram.py" docs/architecture/diagram/{slug}.arch.yaml docs/images/{slug}-architecture.png --check
```
Open the PNG with the Read tool so the developer sees it.

## Step 10 — One revision if needed (AC-F9)

| Result | Action |
|---|---|
| exit 0, `check: ok` | Report `✅ Diagram written: docs/images/{slug}-architecture.png — check: ok` and stop |
| exit 1, `spec error: …` | Show the line, propose the spec fix as a diff, and re-render only after approval. Never edit the renderer |
| exit 1, `check: …` lines | Propose **one** layout change from `references/spec-format.md` § Layout levers as a diff. After approval, apply it to the spec file, re-render, and report the final `check:` result, whatever it is. No second automatic revision; if problems remain, list them and suggest what the developer could change |

After any Step 10 edit to the spec file, check it again before re-rendering:
```bash
node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --secrets --sources --root=. docs/architecture/diagram/{slug}.arch.yaml
```
Exit 1 means the edit introduced a secret pattern or a source gap. Fix it first.

---

## Steps F1–F5 — Refresh a saved spec (`--refresh`, AC-F10)

**F1 — Find the saved spec.** Look in `docs/architecture/diagram/*.arch.yaml`.
- None: `No saved spec — run /arch-diagram first.` Stop.
- More than one: list them and ask which one to refresh.

The chosen file fixes `{slug}` and both paths for the whole refresh. If Step 2 now finds a
different application name, report it and keep the saved file names. The developer can rename
the files afterwards if they want.

**F2 — Collect the items the developer owns.** Every zone, component or flow whose first line
ends with `# manual` is kept exactly as written, children included (see
`references/spec-format.md` § `# manual`). Note each one's id (or name, or `from→to`) and the
zone it sits in.

**F3 — Build a fresh draft.**
1. Run Steps 2–5 again on the current repository. Step 2 only reports the name (F1 fixed the
   paths). The evidence-scan prompt (Step 3b) is shown again.
2. Splice the `# manual` items into the new draft, copying each block exactly, indentation
   included:
   - an item whose id matches a new item replaces it
   - otherwise the item goes back into the zone it was in, at the same place
   - a zone that holds a manual item keeps its saved `name:`, even if the evidence now suggests
     another name. List the suggested name under Changed in F4 for the developer to apply
   - never add `# manual` to a generated item (`--manual-kept` reports it)
   - a `# manual` zone keeps its whole block, components included
   - if the zone a manual item was in has no evidence any more, keep that zone's header (name,
     style) as a zone with `todo: true` and the detail `⚠ TODO: zone has no evidence now — kept for
     # manual item {key}`, and say so in F4
3. Run Step 6 on the result (temp file outside the repository, deleted in the same command),
   adding `--manual-kept=` so the scanner confirms every manual block survived byte for byte:
   ```bash
   node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --secrets --hosts --sources --root=. --manual-kept=docs/architecture/diagram/{slug}.arch.yaml --json "{tmp draft}"; s=$?; rm -f "{tmp draft}"; exit $s
   ```
   - `manual` not empty: a block is missing, changed or moved to another zone. Put it back
     exactly and run again.
   - `secrets` on a line inside a `# manual` block: **stop, with no Write Gate**:
     `❌ BLOCKED — secret pattern ({label}) in # manual item {key}, saved spec line {N}. Fix it in the saved spec and run /arch-diagram --refresh again.`
     The skill never edits a manual block, not even to remove a secret.
   - `secrets` / `sources` anywhere else: as in Step 6.

   In refresh mode, the developer's edits apply to generated items only. Edits to a `# manual`
   item are made by the developer in the saved spec.

**F4 — Show what changed.** Compare the saved spec and the refreshed draft item by item, matching
on id (flows on `from→to`, items without an id on name, and say so):
```
Refresh — {slug}.arch.yaml
  Added    ({n}): {id} — {type} — # source: {path:line}
  Removed  ({n}): {id} — its evidence is gone ({old source})
  Changed  ({n}): {id} — {key}: {old} → {new}
  Kept (manual) ({n}): {id}  {⚠ references missing id {x}, if a manual flow points at a removed item}
  Unchanged: {n}
```
Then show the TODO summary, the hosts and the skipped-files list, as in Step 7, and stop at
the Write Gate:
```
📁 WRITE PENDING — reply APPROVE to update the spec and the image, or SKIP to keep them as they are.
   Spec:  docs/architecture/diagram/{slug}.arch.yaml   (overwrite)
   Image: docs/images/{slug}-architecture.png          (overwrite)
```
`SKIP` leaves both files untouched.

**F5 — Write and render.** After `APPROVE`, overwrite the spec, then run Steps 9–10 (render with
`--check`, show the PNG, at most one layout revision). The Step 10 layout lever must not touch
a `# manual` block. Choose a lever on a generated zone or container, and if only a manual block
could fix the layout, report the problems and let the developer decide. A manual flow that
points at a removed item makes the renderer report `spec error:`. Report it and ask the
developer to fix or remove that manual item. Never edit a `# manual` block yourself.

---

## Steps R0–R3 — Render a hand-written spec (`--spec <file>`)

**R0 — Scan the spec and ask before rendering.**
```bash
node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --secrets --hosts "{spec file}"
```
- **Exit 1 (secret pattern):** stop with
  `❌ BLOCKED — secret pattern ({label}) at spec line {N}. Remove the value from the spec and run again.`
  There is no approval path. Never repeat the matched value in chat. If line {N} is prose rather
  than a value (for example `Password: '…'` holding a sentence), tell the developer to reword it
  without the `password:` form (for example `Credentials rotated by Key Vault`).
- **Exit 2 (cannot read the spec):** show the message (for example a wrong path) and stop.
- **Exit 0:** show the hosts and IPs the scan listed, for information. They are drawn exactly as
  written in the spec.

Then stop at the Write Gate:
```
📁 WRITE PENDING — reply APPROVE to render, or SKIP to discard.
   Spec:   {spec file}
   Output: docs/images/{spec basename without .arch / extension}-architecture.png
   Hosts in the picture: {count} (listed above)
```
Nothing is rendered or written before the developer replies `APPROVE`.

**R1 — Render with checks.** Use the Python path printed by Step 1:
```bash
mkdir -p docs/images
"{python path}" "$PLUGIN_DIR/scripts/architecture-diagram.py" "{spec file}" "{output png}" --check
```

| Exit | Meaning | Next |
|---|---|---|
| 0 | Drawn; `check: ok` | R3 |
| 1 with `spec error: …` | The spec has a mistake; no PNG written | R2 |
| 1 with `check: …` lines | Drawn, but the layout has problems | R2 |
| 2 | Wrong arguments (a skill bug) | Show the output and stop |

**R2 — Report problems.**
- `spec error:`: show the one line and point at the spec key it names. The developer fixes the
  spec. Do not edit the renderer.
- `check:` lines: show them, and suggest one of the layout levers in
  `references/spec-format.md`. In this mode the developer edits their own spec.

**R3 — Show the result.** Open the PNG with the Read tool. Report
`✅ Diagram written: {output png} — check: ok` (or the problem count).

---

## Reference files

| File | When to load |
|---|---|
| `references/app-identity.md` | Step 2: where the application name comes from |
| `references/evidence-map.md` | Steps 3–4: globs, roles, types, read budget |
| `references/spec-format.md` | Steps 4–5, 10 and F2: conventions, `# manual`, a generated example, zone templates, layout levers |
| `references/examples/*.yaml` | Hand-written starting points for `--spec` |
| `$PLUGIN_DIR/scripts/architecture-diagram.py` (docstring) | Spec keys, zone styles, component types, flow kinds, `todo: true` |
| `../shared/source-file-consent.md` | Consent category B: Step 3b bulk-scan prompt |
| `../shared/business-context-severity.md` | Not used: this skill reports no findings |
| `../shared/model-routing-spec.md` | Model routing tiers and env vars |

---

## Hard rules

- ALWAYS run the Step 1 dependency check first. Stop with the install message if anything is missing.
- ALWAYS ask (Step 3b) before reading the evidence files. Never read outside the evidence-map globs, never more than 15 files per role, never `.env`.
- NEVER invent a zone, component or flow. No evidence → `⚠ TODO` + `todo: true`.
- NEVER copy a secret value into the draft, the summary or the chat. Never open settings templates; get their key names with `arch-spec-scan.cjs --keys`.
- ALWAYS re-run `arch-spec-scan.cjs --secrets --sources` on the spec file after any Step 10 edit, before re-rendering.
- ALWAYS pass the draft through Step 6 (`--secrets --hosts --sources`) before showing it; a secret match or a source gap is fixed first, with no approval path.
- NEVER write into the repository before the developer replies `APPROVE`, and never anywhere in it outside `docs/architecture/diagram/` and `docs/images/`. The only file written outside the repository is the Step 6 scratch draft in the OS temp folder, deleted by the same command that scans it.
- NEVER make more than one automatic layout revision (Step 10).
- NEVER change, move or drop a `# manual` item on refresh; `--manual-kept` must report none missing before the refreshed draft is shown.
- NEVER edit `scripts/architecture-diagram.py` from a target project, never add Python packages to the target's dependency files, and never run anything from the target repository.
- NEVER print a matched secret value. Report pattern names and line numbers only.
