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

---

## Initialization

The migration log MUST be created with its full header **before** the first event entry is written.
The creating skill is responsible for this — it is not created implicitly.

Header template (copy verbatim, fill in bracketed values):

```markdown
# Migration Log — {ADO ID}: {feature/migration name}
> Living document. Updated at every decision point. Never truncated — the full history is the asset.
> Source: {source app name} · Target: {target stack/host} · Skill: {Rewrite | Replatform | Upgrade}
> Started: {date} · ADO: {ADO ID}
>
> Session continuation: share this file alongside the design documents and integration inventory.
> Future migrations of similar apps: read the ## Lessons section.

---
```

Create `docs/migrations/{ADO}/` if the directory does not exist.

---

---

## Authorship model

| Author | Writes |
|---|---|
| **Skill (auto)** | Structural facts: what was found, what changed, what was approved, which documents were affected, PROV citations, timestamps |
| **Developer** | Reasoning, context, and lessons: why a decision was made, what was rejected and why, what would be done differently |

The skill writes the skeleton; the developer fills in the reasoning. An event with only skill-authored content is incomplete — the reasoning is what makes the log valuable.

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
| All | Full options insight | In migration log `[OPTION]` entry — full table + comparative insight |

---

---

## Event types

### [FINDING]

**When:** during source analysis, when something is discovered that meaningfully affects the migration.
**Who writes:** skill writes the finding; developer adds "why this matters to us" and "action taken."

```markdown
### [FINDING] {title}

**Discovered:** {what was found — factual, skill-authored}
**Why it matters:** {impact on migration — developer adds context}
**Wrong approach to avoid:** {what would have gone wrong without this finding — developer}
**Action taken:** {what was done with this finding}
```

---

### [INTEGRATION]

**When:** once per external integration, during integration verification.
**Who writes:** skill writes evidence, classification, options; developer confirms and adds choice reasoning.

```markdown
### [INTEGRATION] {integration name}

**Initial state:** PARTIAL | UNVERIFIED — {what was ambiguous}
**Evidence — Tier 1:** PROV: {file}#{line}
**Evidence — Tier 2:** {if additionalDirectories available — what the server source revealed}
**Resolved to:** VERIFIED | PARTIAL | UNVERIFIED
**Classification:** data-access-only | business-logic | mixed | unknown
**Options derived:** A · {description} · B · {description} · C · {description}
**Option chosen:** {A/B/C} — {developer's reasoning for the choice}
**Wrong approach to avoid:** {what would have been chosen without this verification}
```

---

### [OPTION]

**When:** when options are presented to the developer and a selection is made.
**Who writes:** skill writes the options table and analysis; developer writes selection reasoning and rejections.

```markdown
### [OPTION] Options presented — {date}

| Option | Stack / Approach | Clusters | Effort | TCO | Assurance ceiling |
|---|---|---|---|---|---|
| A | {description} | {N} | {S/M/L/XL} | {estimate} | {BAL/NFR level} |
| B | {description} | {N} | {S/M/L/XL} | {estimate} | {BAL/NFR level} |

**Selected:** Option {X}
**Why chosen:** {developer's reasoning — what made this the right choice}
**Option {Y} rejected:** {reason — what would have gone wrong}
**Option {Z} rejected:** {reason}
**Open questions raised:** {any questions the developer had before deciding}
**How resolved:** {how each question was answered before APPROVE OPTIONS}
```

---

### [DECISION]

**When:** at every formal approval (APPROVE OPTIONS, APPROVE DESIGN, APPROVE INTEGRATION,
APPROVE DESIGN for a single document, or any explicit acceptance of a change).
**Who writes:** skill writes what was approved and when; developer writes reasoning.

```markdown
### [DECISION] {what was approved} — {date}

**Approved:** {specific artifact or gate — e.g. "APPROVE OPTIONS — Option B selected"}
**Judge verdict:** {PASS | REVISE | BLOCK} — model: {model used} — {date}
**Judge analysis:** {full text of the judge's output — every finding, every flagged item, every
  reasoning chain. Skill-authored verbatim from judge output; never summarised or paraphrased.
  If no findings: "No findings — artifact met the rubric."}
**Reasoning:** {developer's explicit reasoning — not a summary, the actual rationale}
**Alternatives rejected at this point:** {anything specifically considered and discarded}
**Constraints that shaped this decision:** {technical, business, or compliance constraints}
```

For escalation decisions (iteration 5+ in the feedback loop):

```markdown
### [DECISION] Design revision — escalation override — iteration {N}

**Change requested:** {what the developer wants to change after 5+ iterations}
**Argue + reasoning:** {developer's explicit argument for why this change is necessary}
**Evidence of impact:** {what the skill showed — which decisions reversed, which conflicts emerged}
**Decision:** proceed with change | return to APPROVE OPTIONS
```

---

### [REVISION]

**When:** after every feedback loop revision wave completes.
**Who writes:** skill writes all structural fields automatically; developer adds context if relevant.

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
control is used instead of a stronger assurance. Developer MUST write this — not skill-authored.
**Who writes:** developer writes all fields; skill records what item is being accepted.

```markdown
### [RISK-ACCEPTED] {item description}

**Risk:** {what the risk is}
**Risk level:** RED | YELLOW | HIGH | MEDIUM
**Accepted because:** {explicit developer reasoning — not "we ran out of time"}
**Accepted by:** {developer/architect name}
**Compensating control:** {what alternative protection is in place, if any}
**Review trigger:** {condition that would require re-evaluating this acceptance}
```

---

### [LESSON]

**When:** developer or skill identifies a pattern worth capturing for future migrations of similar apps.
**Who writes:** developer (primarily); skill may suggest a lesson prompt based on decisions made.
**Voice:** teaching voice — explain as if to a future developer who doesn't know this yet.
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
{These entries are the artifact that future migrations read}
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

## Hard rules

- NEVER truncate the log — the full history is the asset.
- ALWAYS initialize `docs/migrations/{ADO}/migration-log.md` with its full header BEFORE writing
  the first event entry — the file must exist before any [INTEGRATION], [FINDING], or [OPTION]
  entries are appended to it.
- The `**Judge analysis:**` field in `[DECISION]` entries MUST be verbatim judge output — not a
  paraphrase. The log is the only human-readable record of the analysis.
- EVERY formal approval (`APPROVE OPTIONS`, `APPROVE DESIGN`, etc.) writes a `[DECISION]` entry.
- EVERY feedback loop revision wave writes a `[REVISION]` entry — automatically.
- EVERY `[RISK-ACCEPTED]` entry MUST be developer-authored — the skill cannot accept a risk on the
  developer's behalf.
- `[LESSON]` entries use teaching voice — explain the wrong approach first, then the right one.
- `[LESSON]` entries live at the bottom regardless of which phase they occurred in.
- The reasoning fields in every event type MUST be developer-authored. A log full of skill-written
  facts with no developer reasoning is not a migration log — it is a timestamp audit.
- The log is shared at session start — it is not an end-of-migration artifact.
