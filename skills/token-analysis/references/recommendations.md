# Token Savings Recommendation Catalogue

Each entry defines a trigger condition, estimated saving, and specific action.
The skill outputs only recommendations whose trigger condition is met by actual data.

---

## STATIC — Fixed overhead recommendations

### REC-S01: CLAUDE.md exceeds 5,000 tokens
- **Trigger**: always-loaded tokens > 5,000
- **Saving**: High (paid every session)
- **Action**: Audit CLAUDE.md sections. Move Extended Conventions and any
  "What to NEVER Do" content to scoped rule files. Move detailed architecture
  notes to `.claude/architecture/` with explicit load instructions.
- **Priority**: Critical

### REC-S02: CLAUDE.md contains @file references to large files
- **Trigger**: Any `@file` reference in CLAUDE.md where the referenced file > 2,000 tokens
- **Saving**: High (paid every session)
- **Action**: Remove the `@` reference from CLAUDE.md. Add the file to the
  Architecture Files table with a "load when" condition. Update relevant skills
  to explicitly load the file when needed.
- **Priority**: Critical

### REC-S03: Rule file scoped to **/* is large
- **Trigger**: A rule file with `paths: ["**/*"]` exceeds 1,000 tokens
- **Saving**: High (paid on every file edit)
- **Action**: Split into smaller scoped rules. Content that only applies to
  `.cs` files should be in a `**/*.cs`-scoped rule, not the universal rule.
- **Priority**: High

### REC-S04: Multiple rule files with overlapping scope
- **Trigger**: Two or more rule files with overlapping `paths:` patterns
  that contain similar content (e.g. "no `any` type" in both project-rules.md
  and angular-rules.md)
- **Saving**: Medium
- **Action**: Deduplicate. Keep the rule in the most specific scope only.
- **Priority**: Medium

### REC-S05: Architecture docs loaded via @ reference in CLAUDE.md
- **Trigger**: `@architecture` or `@Architecture` found in CLAUDE.md
- **Saving**: High (architecture files are 100–500 tokens each)
- **Action**: Remove the @ reference. Add an Architecture Files table to
  CLAUDE.md with explicit "load when" conditions. Skills load them on demand.
- **Priority**: Critical

---

## SESSION — Usage pattern recommendations

### REC-P01: High correction rate
- **Trigger**: correction turns > 15% of total turns across sessions
- **Saving**: High (each correction = 1 wasted turn + re-generation cost)
- **Action**: Review the prompts that preceded correction turns (surfaced in
  prompt rewrites section). Common causes: missing scope ("in UserService.cs"),
  missing format expectation ("as a table"), missing constraint ("without
  changing the interface").
- **Priority**: Critical

### REC-P02: High rate of vague prompts
- **Trigger**: vague prompt type > 30% of all prompts
- **Saving**: High (vague prompts cause Claude to load broad context or ask
  clarifying questions, both of which consume extra turns)
- **Action**: See prompt rewrite examples in this report. General pattern:
  always include (1) what file or component, (2) what specific change,
  (3) what constraint. Example: instead of "fix the search" try
  "fix the null reference in ClientMatterSearchService.SearchAsync — the
  employeeInfo variable can be null when the Adapter API returns 404".
- **Priority**: High

### REC-P03: Same file read multiple times in one session
- **Trigger**: Any file read > 2 times in a single session
- **Saving**: Medium (each re-read costs the file's token size)
- **Action**: Ask Claude to keep the file content in context rather than
  re-reading. Or restructure the workflow so all changes to a file happen
  in one focused session segment before moving on.
- **Priority**: Medium

### REC-P04: Very long sessions (high turn count)
- **Trigger**: Any session with turns > 20
- **Saving**: High (context accumulation means later turns are extremely expensive)
- **Action**: Break long sessions into focused sub-sessions. Each sub-session
  should have a single goal. Use CLAUDE.md and memory files to carry context
  between sessions rather than a single long conversation.
- **Priority**: High

### REC-P05: Multi-task prompts common
- **Trigger**: multi-task prompt type > 20% of all prompts
- **Saving**: Medium
- **Action**: Split multi-task prompts into separate turns. Although this
  increases turn count, each turn is smaller and the total context per turn
  is lower. Example: instead of "fix the null check AND add logging AND update
  the tests", do three sequential prompts.
- **Priority**: Medium

### REC-P06: Skill invoked repeatedly in short time window
- **Trigger**: Same skill invoked > 3 times across the last 5 sessions
- **Saving**: Low–Medium (indicates the skill output isn't being retained
  between sessions, forcing re-generation)
- **Action**: Save the skill's output to a file the first time and reference
  it in subsequent sessions rather than re-generating. For ICEA: save to
  `docs/icea/`. For PR descriptions: save to a draft file.
- **Priority**: Low

### REC-P07: Redundant context in prompts
- **Trigger**: Prompts that repeat content already defined in CLAUDE.md
  (e.g. repeating the ADO org name, the branch naming convention, or stack details)
- **Saving**: Medium
- **Action**: Trust CLAUDE.md. You don't need to repeat facts that are
  already in context. "Create a PR" is sufficient — you don't need to add
  "remember we use Azure DevOps at <your-org>/<your-project> and the target branch is dev".
- **Priority**: Medium

---

## STRUCTURAL — One-time improvements

### REC-T01: No architecture docs present
- **Trigger**: `.claude/architecture/` does not exist or is empty
- **Saving**: Medium (architecture context has to be re-established each session
  through prompts or file reads instead of being loaded from a structured doc)
- **Action**: Run `/ai-assisted-development:setup-init` to generate architecture
  docs automatically.
- **Priority**: High

### REC-T02: memory/ folder missing or empty
- **Trigger**: `memory/MEMORY.md` does not exist or `memory/topic-*.md` count is 0
  after more than 10 sessions
- **Saving**: Medium (without consolidated memory, context is rebuilt from
  scratch each session via longer prompts)
- **Action**: Run `/ai-assisted-development:dream` to consolidate session
  knowledge into topic files.
- **Priority**: High

### REC-T03: CLAUDE.md has not been updated recently
- **Trigger**: CLAUDE.md git modification date > 30 days ago and session count > 10
- **Saving**: Low–Medium (stale CLAUDE.md means Claude may re-discover facts
  that should be in memory, leading to longer sessions)
- **Action**: Run `/ai-assisted-development:dream` to promote high-confidence
  session knowledge into CLAUDE.md.
- **Priority**: Low
