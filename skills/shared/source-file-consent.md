# Source File Consent Spec
_Spec version: 1.0 · Created: 2026-06-01_
_Applies to: all skills that read source files (security, code-review, icea-review,
pr-spec-review, bug, checkin, update-arch, prod-readiness, dynamic-scan)_

---

## The principle

**Claude must never read a source file without telling the developer why.**

Every skill that reads source files beyond architecture docs and git diffs must:
1. State **which file(s)** it intends to read
2. State **why** — the specific question it cannot answer without reading that file
3. State **what it will look for** — not "understand the code", but a specific target
4. **Wait for confirmation** unless the developer has already explicitly granted consent
   for this skill invocation (see Consent categories below)

This applies to individual file reads and to bulk scans. The justification
must be proportionate to the scope — a single file read needs one sentence;
a full codebase scan needs a paragraph.

---

## Consent categories

### Category A — Implicit consent (no gate needed)

The developer has already consented by invoking the command or skill:

| Invocation | What is implicitly consented |
|---|---|
| `/code-review` | Scan all candidate files (as defined by scope flag) |
| `/code-review --changed` | Scan all staged/modified files |
| `/security-review` | Scan all candidate files + static asset directories |
| `/dynamic-scan` | Run a live DAST scan against the target URL; read source only via the Category B gate when mapping a finding back to a file |
| `/checkin` | Scan all staged files for secrets and code quality |
| `/fix FP-xxxx` | Read the one file containing the fingerprinted finding |
| `/critic code` (standalone) | Read staged/modified files — announce scope first, same model as `/code-review --changed` |
| `APPROVED` (after bug or ICEA spec) | Read only the files listed under "Files involved" in the spec |

For Category A, the skill announces what it will read and why in the scope report,
then proceeds. No confirmation prompt is needed.

### Category B — Explicit consent required (gate applies)

The skill must ask before reading source when:

- The skill is not primarily a scan tool (icea-feature, icea-review, pr-spec-review, bug, update-arch, explain, prod-readiness)
- The skill reaches a decision point where source context would improve accuracy
- The file was not explicitly named in the developer's request

### Category C — Never read source (hard rule)

Some skills must never read source files regardless of consent:

| Skill | Hard rule |
|---|---|
| `session-start` | Architecture docs and memory only — never source |
| `dream-status` | File system checks only — never source content |
| `dream` | Session history only — never source |
| `critic` (internal, or `icea` mode) | In-context artefact + ICEA + architecture docs only — never reads source from disk |

---

## The gate format

When a skill needs to read a source file (Category B), it must use this format:

```
📂 Source file access request

  File    : {path/to/file.ts}
  Why     : {specific question — e.g. "The ICEA says the filter applies in
             MatterListComponent but the domain-map shows it might be in
             MatterFilterService — I need to verify which file the AC refers to
             before writing the compliance finding."}
  Looking for: {specific target — e.g. "the filterMatters() method and whether
                it validates the roleId parameter before use"}
  Token cost: ~{estimated tokens} (file is ~{N} lines)

Read this file? (yes / no / read a different file)
```

If the developer says **no**: the skill continues without that file, notes the
uncertainty in its output, and does not ask again for the same file in the same invocation.

If the developer says **read a different file**: accept the path and apply the same gate
to the new file before reading it.

---

## Bulk scan consent (for scans of 10+ files)

When a skill would read more than 10 files (e.g. pr-spec-review reading all changed files,
prod-readiness doing a targeted deep read), use this condensed gate:

```
📂 Source file scan request

  Files   : {N} files ({list first 3, then "and N more"})
  Why     : {specific reason the diff/architecture docs are insufficient}
  Looking for: {what the scan targets — e.g. "spec compliance for AC-1 through AC-7"}
  Token cost: ~{N × avg file size} tokens estimated

Scan these files? (yes / no / scan only changed files / tell me which ones)
```

---

## Justification quality standard

A justification must answer:
- What specific information is missing from architecture docs, domain-map, or the git diff?
- Why is that information necessary for the current task (not just "would be helpful")?
- What is the minimum number of files needed?

Bad justification (do not use):
> "To better understand the codebase"
> "To provide a more accurate review"
> "For context"

Good justification:
> "The diff modifies MatterRepository.cs but the ICEA AC-3 says 'must validate
> client role before returning matters'. I can see the method signature changed
> in the diff but not whether the validation was added inside the method body.
> Reading this file confirms or denies AC-3 compliance."

> "The domain-map lists DataImportService as the entry point for the Bulk Import
> area, but the diff touches three files in that area. I need to read
> DataImportService.cs to understand the call chain and determine whether the
> change in BulkImportValidator.cs (one of the three) is in scope for ICEA AC-5."

---

## Token cost estimation

Skills must provide an honest token estimate before the gate:

| File size | Estimated tokens |
|---|---|
| < 100 lines | ~300 tokens |
| 100–300 lines | ~800 tokens |
| 300–600 lines | ~1,500 tokens |
| 600–1,000 lines | ~2,500 tokens |
| > 1,000 lines | ~4,000+ tokens — consider whether a targeted section would suffice |

For bulk scans: multiply average file size estimate by file count.

---

## How each skill applies this spec

### Category grammar (single source of truth)

This table is the **authoritative declaration** of each skill's consent category.
Every `skills/<name>/SKILL.md` must carry a matching `Consent:` token in its
metadata line (the `_Skill version: …_` line under its H1), and the structural
validator (`tests/validate.py`) errors if the token and this table disagree.

The category cell uses a fixed grammar so it can be parsed and compared:

```
<token>  ::= <clause> ( "|" <clause> )*
<clause> ::= <letter> [ "(" <context> ( "," <context> )* ")" ]
<letter> ::= "A" | "B" | "C"
```

- A bare letter (e.g. `C`) means the skill is that category in all contexts;
  it normalises to a single pair `(C, default)`.
- A compound token (e.g. `C(internal,icea)|A(code-standalone)`) declares
  context-specific categories — used by skills that behave differently depending
  on how they are invoked. Each context is checked independently.

Keep the **Skill** column equal to the skill's directory name exactly — the
validator joins on it. One row per skill. Do not add command-only entries here;
those live in the command reference table below.

| Skill | Consent | Gate applied at |
|---|---|---|
| `code-review` | A | Scope report before scan begins |
| `security` | A | Scope report (incl. static-asset audit) before scan begins |
| `icea-feature` | C | Never reads source; architecture docs only |
| `icea-review` | B | Gate before reading any file beyond diff |
| `pr-spec-review` | B | Bulk gate before reading changed source files |
| `pr-create` | B | icea-review gate applies; pr-create itself reads diff only |
| `pr-describe` | C | Reads git diff only — no source file access |
| `product-docs` | B | Gate before reading any source file for doc generation |
| `architect` | B | Gate before reading entry-point files when building the map |
| `ado-tasks` | C | Reads ADO API only — never reads source files |
| `sprint-metrics` | C | Reads ADO API only — never reads source files |
| `token-analysis` | C | Reads session history and graph cache only — never reads source |
| `dream-rollback` | C | Reads and writes memory files only — never reads source |
| `dream-status` | C | File system checks only — never reads source content |
| `app-readiness` | B | Bulk gate before targeted readiness reads |
| `plugin-readiness` | C | Plugin state files only — never reads application source |
| `critic` | C(internal,icea)\|A(code-standalone) | Internal & ICEA-mode read in-context artefact only (C); standalone code mode announces scope before reading changed files (A) |
| `dynamic-scan` | A(scan)\|B(finding-map) | Live scan is implicit-consent (A); mapping a finding back to a source file uses the per-file gate (B) |
| `external-dir-map` | C | Reads manifest files (package.json, .csproj, pom.xml etc.) only — never reads application source |

### Command reference (informational — not validator-checked)

These are command entry points whose source-access behaviour is governed by the
skill they invoke, or which are thin enough not to back a skill of their own.
They are listed for the reader; the validator does not parse this table.

| Command | Category | Gate applied at |
|---|---|---|
| `/code-review` · `/security-review` | A (via skill) | Scope report before scan begins |
| `/checkin` | A — staged files only | Scope report before scan begins |
| `/fix FP-xxxx` | A — one specific file | Before reading the file in the fix step |
| `/bug` | B — post-approval | Gate before each file read after the Bug Spec is approved |
| `/update-arch` | B | Gate before reading changed entry-point files (command form of the architect refresh) |
| `/explain` | C | Architecture docs only — never reads source |
| `/session-start` | C | Architecture docs and memory only — never reads source |
| `/dream` · `/dream-health` | C | Session history / memory files only — never reads source |
