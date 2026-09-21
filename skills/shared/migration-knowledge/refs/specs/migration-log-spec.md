# Spec: Migration Log

_Defines the format, event types, and authorship rules for `migration-log.md` — the living record
of every decision, finding, revision, and lesson from a migration. Applies to all migration-family
skills (**Upgrade · Rewrite · Replatform**)._

> **Two purposes.**
> 1. **Audit trail** — for this migration: what was found, decided, rejected, and why.
>    A future engineer reading the log understands not just WHAT was built but HOW you got there.
> 2. **Lesson-learned asset** — `[LESSON]` entries at the bottom travel to future similar migrations,
>    teaching what the diagrams and specs don't capture.
>
> **How to use this file (session continuation):**
> Share alongside the design documents and integration inventory at the start of each session.
> The log re-establishes context without re-deriving decisions already made.

---

## File location and naming

```
docs/migrations/{MIGRATION_ID}/migration-log.md
```

One log per migration. Started at the first source analysis event; updated continuously through
completion. Never truncated — the full history is the asset.

The **migration tracker** (`migration-tracker.md` in the same folder) is the companion resume
file — updated at every step transition, committed, and read by `REWRITE RESUME` to orient
without re-analysis. The migration log is the full audit trail; the tracker is the current-state
pointer.

---

## Initialization

The migration log MUST be created with its full header **before** the first event entry is written.
The creating skill is responsible for this — it is not created implicitly.

Header template (copy verbatim, fill in bracketed values):

```markdown
# Migration Log — {AppName} {Skill} (ADO-{ID})
Living document. Updated at every decision point. Never truncated — the full history is the asset.
Source: {full/source/path} ({source stack} {source version}) · Target: {target stack + versions} · {architecture pattern} · {hosting} · Skill: {Rewrite | Replatform | Upgrade}
Started: {date} · ADO: {ADO ID}

Session continuation: share this file alongside the design documents and integration inventory.
Future migrations of similar apps: read the ## Lessons section.

---

## Phase 1: Source Analysis

## Phase 2: Options

## Phase 3: Target Design

## Phase 4: Generation

## Phase 5: Verification

---

## Decisions summary

| Decision | Chosen | Alternatives rejected | Date |
|---|---|---|---|

## Risks accepted

| Risk | Level | Accepted because | Compensating control |
|---|---|---|---|

---

## Lessons

```

Create `docs/migrations/{ADO}/` if the directory does not exist. Phase headings are pre-populated empty so events can be appended without a separate create step. The Decisions summary, Risks accepted, and Lessons sections are pre-populated so they are ready to receive rows as decisions are made — never pre-fill them with placeholder data.

---

---

## Authorship model

| Author | Writes |
|---|---|
| **Skill (auto)** | All fields in every event type — structural facts, inferred reasoning, context derived from source analysis and design decisions, lessons, and TP entries. No placeholders are left unfilled. |
| **Developer** | Reviews entries for accuracy. For `[RISK-ACCEPTED]` entries: confirms the acceptance, provides the "Accepted by" name, and may augment the reasoning before the migration proceeds. |

The skill writes the complete log entry at the moment the event occurs, using the evidence available from source analysis, integration verification, developer gate responses, and migration context. The developer's role is review and confirmation — not authoring.

---

## Required disk artifacts

All decision-grade artifacts generated during a migration must have a disk file. The migration
log is the human-readable index; standalone report files are the decision-grade records.

| Skill | Artifact | Path |
|---|---|---|
| Upgrade | Gap + Risk Report | `docs/migrations/{ADO}/ADO-{ID}-gap-risk-report.md` |
| Rewrite | Per-cluster BAL + ERL | `docs/migrations/{ADO}/ADO-{ID}-cluster-{N}-assurance.md` |
| Rewrite | Combined assurance summary | `docs/migrations/{ADO}/ADO-{ID}-assurance-summary.md` |
| Replatform | NFR assurance + WA + behavioral regression | `docs/migrations/{ADO}/ADO-{ID}-nfr-assurance-report.md` |
| Replatform | Reconciliation gate results | `docs/migrations/{ADO}/ADO-{ID}-reconciliation-report.md` |
| All | Full judge analysis | In migration log `[DECISION]` entry — `**Judge analysis:**` field |
| Rewrite | Migration tracker | `docs/migrations/{ADO}/migration-tracker.md` — created at Step 0; updated at every step and gate transition; the committed, human-readable resume mechanism. |
| Rewrite | Options file | `docs/migrations/{ADO}/{ADO}-options.md` — written to disk at Step 2 before APPROVE OPTIONS; status line updated to "Option X selected" after APPROVE OPTIONS. |

---

---

## Event types

### [FINDING]

**When:** during source analysis, when something is discovered that meaningfully affects the migration.
**Who writes:** skill writes all fields at the time of discovery, based on source analysis evidence.

```markdown
### [FINDING] {title}

**Discovered:** {what was found — factual, with PROV citations}
**Why it matters:** {impact on migration — inferred from source evidence and architecture decisions}
**Wrong approach to avoid:** {what the naive approach would have been without this finding}
**Action taken:** {what decision or design change resulted from this finding}
```

---

### [INTEGRATION]

**When:** once per external integration, during integration verification.
**Who writes:** skill writes all fields, including option reasoning, from the integration inventory and architecture constraints.

```markdown
### [INTEGRATION] {integration name}

**Initial state:** PARTIAL | UNVERIFIED — {what was ambiguous}
**Evidence — Tier 1:** PROV: {file}#{line}
**Evidence — Tier 2:** {if additionalDirectories available — what the server source revealed}
**Resolved to:** VERIFIED | PARTIAL | UNVERIFIED
**Classification:** data-access-only | business-logic | mixed | unknown
**Options derived:** A · {description} · B · {description} · C · {description}
**Option chosen:** {A/B/C} — {reasoning derived from integration classification and architecture constraints}
**Wrong approach to avoid:** {what the naive approach would have been without this verification}
```

---

### [OPTION]

**When:** when options are presented to the developer (before APPROVE OPTIONS) and again when a selection is made.
**Who writes:** skill writes all fields. The full options content is written to the options disk file (`ADO-{ID}-options.md`) at Step 2 before presenting to the developer. The migration log `[OPTION]` entry is a brief pointer to that file — it does not duplicate the full table.

```markdown
### [OPTION] Options presented — {date}

**Options file:** docs/migrations/{ADO}/ADO-{ID}-options.md
**Options presented:** A · {one-line description} · B · {one-line description} · C · {one-line description}
**Assurance ceiling (all options):** {BAL level} — {oracle mode}
**Selected:** Option {X} — {date of APPROVE OPTIONS}
**Why chosen:** {reasoning inferred from the developer's selection, stated constraints, and options analysis}
**Option {Y} rejected:** {reason derived from the comparative options analysis}
**Option {Z} rejected:** {reason derived from the comparative options analysis}
**Pre-design questions answered:** {keep-vs-redesign answer · hosting answer}
```

---

### [DECISION]

**When:** at every formal approval (APPROVE OPTIONS, APPROVE DESIGN, APPROVE INTEGRATION,
APPROVE DESIGN for a single document, or any explicit acceptance of a change).
**Who writes:** skill writes all fields at the time of gate approval, using the judge output verbatim and reasoning inferred from gate context, source analysis, and constraints stated during the migration.

```markdown
### [DECISION] {what was approved} — {date}

**Approved:** {specific artifact or gate — e.g. "APPROVE OPTIONS — Option B selected"}
**Judge verdict:** {PASS | REVISE | BLOCK} — model: {model used} — {date}
**Judge analysis:** {full text of the judge's output — every finding, every flagged item, every
  reasoning chain. Verbatim from judge output; never summarised or paraphrased.
  If no findings: "No findings — artifact met the rubric."}
**Reasoning:** {reasoning inferred from gate context, source evidence, and constraints stated during the migration}
**Alternatives rejected at this point:** {alternatives surfaced during this gate and why they were not chosen}
**Constraints that shaped this decision:** {technical, business, or compliance constraints identified during the migration}
```

For escalation decisions (iteration 5+ in the feedback loop):

```markdown
### [DECISION] Design revision — escalation override — iteration {N}

**Change requested:** {what the developer asked to change after 5+ iterations}
**Argue + reasoning:** {the argument for why this change is necessary, inferred from the developer's request and the design context}
**Evidence of impact:** {what the skill showed — which decisions reversed, which conflicts emerged}
**Decision:** proceed with change | return to APPROVE OPTIONS
```

---

### [REVISION]

**When:** after every feedback loop revision wave completes.
**Who writes:** skill writes all fields automatically at the time the revision wave completes.

```markdown
### [REVISION] {document name(s)} — iteration {N} — {date}

**Triggered by:** {what the developer changed or added}
**Documents revised:** {list}
**Sections changed per document:** {doc → sections}
**Cascade reason:** {why each document was in scope — the dependency path}
**Stale flags found:** {N flags in {list of documents}}
**Developer resolution per flag:**
  - §{N} in {doc}: {confirmed | updated: "new text" | deleted}
**Validation result:** PASS | FAIL — {details if fail}
**Option change detected:** no | yes → see [OPTION CHANGE] entry
```

---

### [RISK-ACCEPTED]

**When:** when a RED/YELLOW item is explicitly accepted, MEDIUM drift is accepted, or a compensating
control is used instead of a stronger assurance.
**Who writes:** skill drafts all fields from detected risk context and migration evidence, then
presents the entry for developer confirmation. The developer MUST confirm "Accepted by" and may
refine "Accepted because" before the migration proceeds. The skill cannot accept a risk on the
developer's behalf — it proposes; the developer decides.

```markdown
### [RISK-ACCEPTED] {item description}

**Risk:** {what the risk is — inferred from source analysis and assurance grading}
**Risk level:** RED | YELLOW | HIGH | MEDIUM
**Accepted because:** {reasoning inferred from the migration context — developer refines if incorrect}
**Accepted by:** {developer/architect name — developer confirms this field}
**Compensating control:** {compensating measure identified from the migration design, if any}
**Review trigger:** {condition that would require re-evaluating this acceptance}
```

---

### [LESSON]

**When:** a pattern worth capturing for future migrations is identified — triggered by the skill from significant findings, integration decisions, or BAL gate outcomes during the migration.
**Who writes:** skill writes all fields in teaching voice, derived from the migration's findings, decisions, and lessons encountered. Developer reviews for accuracy.
**Voice:** teaching voice — explain the wrong approach first, then the right one, as if to a future developer who doesn't know this yet.
**Location:** consolidated in the `## Lessons` section at the bottom of the log.

```markdown
### [LESSON] {title}

**The wrong approach to avoid:**
{what a future developer might naturally try that would be wrong — be specific}

**The right approach:**
{what actually works — the insight that took effort to learn}

**Why it matters:**
{consequence of getting this wrong — what breaks, what's silent, what's expensive}

**Applies to migrations of:**
- Stack: {e.g. dotnet-framework, wcf, angular}
- Migration type: {rewrite | replatform | upgrade}
- When triggered by: {condition — e.g. "any WCF service with Windows auth"}

**Spec/decision reference:** {link to the relevant spec or [DECISION] entry}
```

---

## Phase structure

The log is organised by migration phase. Events appear under the phase in which they occurred.
New phases are added as the migration progresses — never pre-populated.

```markdown
# Migration Log — {Migration Name}
> Living document. Updated at every decision point.
> Source: {source app} · Target: {stack/host} · Skill: {Rewrite | Replatform | Upgrade}
>
> Session continuation: share this file alongside the design documents and integration inventory.
> Future migrations of similar apps: read the ## Lessons section.

---

## Phase 1: Source Analysis
{[FINDING] and [INTEGRATION] events}

## Phase 2: Options
{[OPTION] and [DECISION] (APPROVE OPTIONS) events}

## Phase 3: Target Design
{[DECISION] (per document), [REVISION], [RISK-ACCEPTED] events}

## Phase 4: Generation
{[FINDING] (unexpected behavior), [DECISION] (BAL/ERL gates) events}

## Phase 5: Verification
{[DECISION] (golden master mode, as-built reconciliation), [RISK-ACCEPTED] (accepted drift) events}

---

## Decisions summary

| Decision | Chosen | Alternatives rejected | Date |
|---|---|---|---|
| {gate or artifact} | {what was approved} | {what was not} | {date} |

## Risks accepted

| Risk | Level | Accepted because | Compensating control |
|---|---|---|---|

---

## Lessons

{[LESSON] entries — consolidated here regardless of which phase they occurred in}

---

## Transferable Patterns

{TP-{N} entries — generated at the completion gate from ## Lessons; developer-validated}
{Each entry is the generic, application-agnostic form of the corresponding lesson}
```

---

## How lessons feed skill improvement

`[LESSON]` entries are structured for aggregation across migration logs. The `applies_to` fields
allow a future lesson-aggregator to find all lessons relevant to a specific migration:

- All lessons for `.NET Framework → .NET` migrations: filter `stack: dotnet-framework`
- All lessons for any WCF integration: filter `when triggered by: "WCF"`
- All lessons about data-access-only services: filter `stack: wcf` + `migration type: rewrite`

Patterns that appear across multiple migration logs (the same lesson learned independently by
different teams) are candidates for promotion into the migration skill specs themselves —
eliminating the need for future teams to learn them the hard way.

---

## Transferable Patterns

_Populated by the skill at the **completion gate** (Step 5), after all `[LESSON]` entries are
written. Each entry is the application-agnostic distillation of a corresponding lesson —
no app names, no internal URLs, no team-specific detail. Developer validates before closing._

> **Two audiences.**
> 1. **This migration** — a quick summary of what was learned, stripped of project noise.
> 2. **Future similar migrations** — the section a future team reads FIRST. It captures the
>    portable pattern without requiring any knowledge of this project.

### Format

Each entry maps 1-to-1 with a `[LESSON]` entry in `## Lessons`:

```markdown
### TP-{N}: {Pattern title — generic, no app names}

**Applies to:** Stack: {stack tokens, e.g. dotnet-framework, wcf} · Migration type: {rewrite | replatform | upgrade}
**When triggered by:** {condition stated generically — no app/service/team names}
**The pattern:** {2–4 sentences. Fully generic. Describes the wrong approach first, then the right
  one, and why it matters. No internal hostnames, NuGet package names specific to one firm,
  directory paths, or role-code values.}
**Source lesson:** [LESSON] {exact title from the ## Lessons section}
```

### Authorship

| Author | Writes |
|---|---|
| **Skill (auto)** | Generates all TP entries at the completion gate from the `[LESSON]` entries — strips app-specific names, paths, URLs, and internal identifiers; states the pattern generically |
| **Developer** | Reviews each entry: confirms the pattern is accurate and portable; adds or corrects the "When triggered by" condition; removes any residual project-specific detail |

### Aggregation

`TP-{N}` entries use the same `Applies to` vocabulary as `[LESSON]` entries so they can be
aggregated across migration logs — e.g. "all patterns for `stack: wcf` + `migration type: rewrite`"
forms the WCF rewrite playbook without requiring per-project context.

---

## Hard rules

- NEVER truncate the log — the full history is the asset.
- ALWAYS initialize `docs/migrations/{ADO}/migration-log.md` with its full header BEFORE writing
  the first event entry — the file must exist before any [INTEGRATION], [FINDING], or [OPTION]
  entries are appended to it.
- The `**Judge analysis:**` field in `[DECISION]` entries MUST be verbatim judge output — not a
  paraphrase. The log is the only human-readable record of the analysis.
- EVERY formal approval (`APPROVE OPTIONS`, `APPROVE DESIGN`, etc.) writes a `[DECISION]` entry.
- EVERY feedback loop revision wave writes a `[REVISION]` entry — automatically.
- EVERY `[RISK-ACCEPTED]` entry is skill-drafted — the skill writes all fields from detected risk
  context, then presents the entry for developer confirmation. The developer MUST confirm "Accepted by"
  before the migration proceeds. The skill proposes; the developer accepts.
- `[LESSON]` entries use teaching voice — explain the wrong approach first, then the right one.
- `[LESSON]` entries live at the bottom regardless of which phase they occurred in.
- NEVER leave placeholder text (`{developer to fill in}`, `{developer adds}`, `{TBD}`, etc.) in
  any log entry — the skill writes all content at the moment the event occurs, using available
  evidence. If a field cannot be inferred, state the gap explicitly (e.g. "Accepted by: to be
  confirmed by developer") and flag it for review.
- The log is shared at session start — it is not an end-of-migration artifact.

- ALWAYS populate `## Transferable Patterns` at the completion gate before closing the migration — one TP entry per [LESSON]. If there are no [LESSON] entries, write "No lessons captured — add before closing." as a reminder.
- NEVER carry project-specific names (app names, internal hostnames, firm-specific package names, internal directory paths) into TP entries — the pattern must be readable by a future team with no knowledge of this project.
