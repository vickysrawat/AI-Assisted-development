# Three-Pass Scan Architecture
_Spec version: 1.0 · Last changed: 2026-07-06 · Applies to: code-review, security_

Shared by: `code-review`, `security`

Defines the canonical three-pass scan architecture used by review skills. Both
skills must implement all three passes in order. Each pass has a distinct job,
and later passes receive the findings of earlier ones with an explicit
de-duplication gate.

---

## Architecture overview

```
Pass 1 — STRUCTURED RULE-BASED SCAN
   Known categories, deterministic checks. Fast, reproducible.
   Owns any hard pass/fail signal (secrets, SAST, dependency checks).
        |
        v
Pass 2 — SPECIALIZED PERSONA PASSES
   Several focused reviews, each anchored to one threat model.
   Catches what a flat checklist misses because it reasons like a
   specific kind of attacker or auditor.
        |
        v
Pass 3 — FREE-FLOW ADVERSARIAL PASS
   Open-ended. De-scoped from everything above. Catches the
   unknown, the contextual, and the interactions between changes.
```

---

## Pass 1 — Structured Rule-Based Scan

### Purpose

Apply known, deterministic checker patterns to every in-scope file. These are
the equivalent of Coverity checkers, Semgrep rules, or OWASP pattern matchers.
A finding from Pass 1 is reproducible: the same code always produces the same
finding.

### Characteristics

| Property | Value |
|---|---|
| Deterministic | Yes — same input = same findings |
| Stack-specific | Yes — load only the checkers for detected languages |
| Output | Fingerprinted findings (FP-xxxxxxxx) with concrete fix snippets |
| Dedup gate | None (first pass) |
| Hard signals | Secrets, known injection patterns, critical misconfigs = fail |

### How skills define Pass 1

Each skill defines its Pass 1 checkers in language-specific reference files:

- `code-review`: `$PLUGIN_DIR/skills/code-review/references/pass1-checkers.md` + `pass1-checkers-{lang}.md`
- `security`: `$PLUGIN_DIR/skills/security/references/pass1-patterns.md` + `pass1-patterns-{lang}.md`

Checkers are loaded dynamically based on Step 0 stack detection. A pure Python
project never loads .NET checkers. A polyglot repo loads all matching files.

### Pass 1 output format

Every Pass 1 finding must include:
1. A fingerprint (see `fingerprint-spec.md`)
2. A checker/pattern ID
3. File, function/location, event path
4. Severity (technical + business override per `business-context-severity.md`)
5. Vulnerable code snippet
6. Corrected code snippet (copy-pasteable fix)

---

## Pass 2 — Specialized Persona Passes

### Purpose

Apply focused expert reasoning through distinct threat-model lenses. Each
persona has ONE job and a defined scope. Personas catch what flat checklists
miss because they reason about intent, context, and interaction — not just
pattern matches.

### Characteristics

| Property | Value |
|---|---|
| Deterministic | No — LLM-reasoned, may vary between runs |
| Stack-specific | No — personas reason about patterns, not syntax |
| Output | Findings with evidence citations (file/function/pattern) |
| Dedup gate | Yes — receives Pass 1 findings, MUST NOT re-report |
| Cap | Each persona: max 5 findings (quality over quantity) |

### How personas work

Each skill defines its persona set in its own `$PLUGIN_DIR/skills/<skillname>/references/pass2-personas.md`. A persona
definition includes:

```
## P{N}. {Persona Name}

Lens: "{one-sentence focus}"

Looks for:
- {specific concern 1}
- {specific concern 2}
- ...

Does NOT look for:
- {explicitly excluded — covered by Pass 1 or another persona}

Evidence rule: Every finding must cite a specific file, function, or code
pattern. "In my experience" is never evidence.
```

### De-duplication gate (mandatory)

Before each persona begins analysis, inject this instruction:

```
You have already found these findings in Pass 1:
{summary of Pass 1 findings — fingerprint, file, vuln_class}

DO NOT re-report any finding that covers the same file + vulnerability class
combination. A finding is a duplicate if it names the same file AND the same
category of issue (e.g., SQL injection, null reference, missing auth check).

Only report findings that add NEW information not captured above.
```

### Persona ordering

Personas run sequentially. Each persona also sees prior personas' findings in
addition to Pass 1. This prevents persona-to-persona duplication:

```
Persona P1: sees Pass 1 findings
Persona P2: sees Pass 1 + P1 findings
Persona P3: sees Pass 1 + P1 + P2 findings
Persona P4: sees Pass 1 + P1 + P2 + P3 findings
```

### Persona governance

All personas are subordinate to:
- `personas-spec.md` guardrails (lens not roleplay, no assumptions)
- `CLAUDE.md` section 3 (do not assume — stop and ask when ambiguous)
- `business-context-severity.md` (B1-B7 override triggers)

Personas never name themselves in findings. Findings never say "As an attacker,
I would..." — they cite evidence and describe risk.

---

## Pass 3 — Free-Flow Adversarial Pass

### Purpose

Open-ended analysis that catches what no checklist or persona anticipated.
Focuses on interaction effects, architectural risks, business logic flaws, and
the gaps between components.

### Characteristics

| Property | Value |
|---|---|
| Deterministic | No — fully open-ended |
| Stack-specific | No — reasons about design and interactions |
| Output | Risk hypotheses with evidence citations |
| Dedup gate | Yes — receives ALL prior findings (Pass 1 + Pass 2) |
| Cap | Max 7 findings |
| CVSS | No — qualitative severity only |
| Label | "LLM-inferred risk hypotheses — validate before treating as confirmed" |

### De-duplication gate (mandatory)

```
The structured scan (Pass 1) and persona passes (Pass 2) found these:
{complete summary of all prior findings}

DO NOT re-report anything already covered. A finding is a duplicate if it
names the same file AND the same vulnerability class as any prior finding.

Focus on:
- Interaction effects between components
- Business logic flaws that no pattern catches
- Trust boundary violations across service seams
- Insecure defaults under specific deployment configs
- Race conditions, TOCTOU, error-handling gaps
- "What did all the above passes miss?"
```

### Pass 3 output format

```
### {Risk Name}

Severity: {Critical | High | Medium | Low} — {one-line justification}
Likelihood: {one-line justification}

Evidence:
  {cite specific file, function, or pattern observed}

Why it matters here:
  {reference the specific code and explain the risk in THIS codebase}

Mitigation:
  {specific config or code change — not generic advice}
```

---

## Report assembly

After all three passes complete, the skill assembles the final report:

```
1. Pass 1 findings → structured findings table (fingerprinted, in ledger)
2. Pass 2 findings → "Expert Analysis" section (fingerprinted where fixable)
3. Pass 3 findings → "Risk Hypotheses" section (not fingerprinted, advisory)
4. Summary statistics (open/fixed/dismissed counts from ledger reconciliation)
```

Pass 1 and Pass 2 findings with concrete fixes get fingerprints and enter the
ledger. Pass 3 findings are advisory-only and do not enter the ledger unless
the developer promotes them via `/fix`.

---

## Stack-agnostic loading

Both skills detect the project's language stack before loading any reference
files. The detection runs once in Step 0 and informs all three passes:

```
Step 0b — Stack detection

1. Read architecture.md → detected_stacks (authoritative if available)
2. Fallback: file extension scan
   *.cs        → dotnet
   *.java      → java
   *.py        → python
   *.ts, *.js  → typescript
   *.go        → go
   *.rb        → ruby
   *.php       → php

3. Load ONLY matching reference files:
   dotnet     → pass1-{checkers|patterns}-dotnet.md
   java       → pass1-{checkers|patterns}-java.md
   python     → pass1-{checkers|patterns}-python.md
   typescript → pass1-{checkers|patterns}-typescript.md
   (no match) → universal checkers/patterns only

4. Polyglot repos load ALL detected stacks
```

Announce what was loaded and what was skipped. Never load reference files for
languages not present in the codebase.

---

## Hard rules

- **Pass order is mandatory.** 1 → 2 → 3. Never skip a pass. Never reorder.
- **De-duplication is mandatory.** Every pass after Pass 1 receives prior findings
  and must not re-report them. This is not advisory — it is a hard gate.
- **Evidence is mandatory.** Every finding in every pass must cite a specific file,
  function, or code pattern. No finding without evidence.
- **Stack detection is mandatory.** Never hardcode language assumptions. Load
  checkers dynamically based on what is actually in the codebase.
- **Persona cap is mandatory.** Each persona: max 5 findings. Pass 3: max 7.
  Quality over quantity.
- **Business severity overrides apply to all passes.** Per
  `business-context-severity.md`, B1-B7 triggers raise severity regardless of
  which pass found the issue.
