# 0045 — Free-form LLM risk analysis as a final pass in the security skill
Status: Accepted · Date: 2026-07-07
Governs: `skills/security/SKILL.md` (§3), `commands/security-review.md`

## Problem
The security skill performs structured SAST analysis using OWASP/CWE pattern rules applied
at the file level. Pattern matching reliably identifies known vulnerability classes — SQL
injection, missing auth headers, hardcoded secrets, insecure deserialisation — but it is
structurally blind to:

- **Architectural risks** that emerge from how components interact: a service that trusts
  a user-controlled header, a trust boundary crossed without re-verification, a data-flow
  risk that requires reading three files simultaneously to see.
- **Logic flaws** that are not pattern-recognisable: race conditions, TOCTOU issues,
  business logic bypasses, or multi-step attack chains.
- **Context-sensitive severity**: in a legal or healthcare application, a data flow that
  is Medium severity in a generic app may be Critical. Pattern rules do not know the
  application domain.

These gaps are inherent to file-level pattern matching and cannot be closed by adding more
rules. A second qualitatively different analysis lens is needed.

## Decision
After the structured SAST scan completes and the security ledger is written, the skill
runs a final free-form LLM pass (§3 in the skill, appended to the HTML report as a
"Free-form Risk Analysis" section).

**Prompt constraints and the rationale for each:**

| Constraint | Why |
|---|---|
| Evidence citation required (file, function, or pattern) | Prevents hallucinated generic risks. The LLM cannot claim a risk exists without pointing to specific code. |
| Up to 7 risks | Enough for genuine architectural concerns; more invites padding despite the evidence requirement. |
| "Report fewer if you cannot find 5 well-grounded risks" | Explicitly grants the model permission to say "I only found 3," preventing list-padding to meet an implicit quota. |
| No CVSS scores | Structured findings use CVSS. Qualitative severity here avoids false comparability — these are hypotheses, not verified findings. |
| Do not repeat structured ledger findings | Prevents duplication and noise. Duplicate defined as: same file + same vulnerability class. Broader architectural context is acceptable. |
| Scope limitation (files in scan scope only) | For `--pr` scans with a small file set, prevents the model from reasoning about code it has not read — the primary hallucination vector. |
| Label: "LLM-inferred risk hypotheses — validate before treating as confirmed" | Sets the correct epistemic status. These are candidates for investigation, not confirmed vulnerabilities. |

**Output format per risk:**
- Name
- Severity and likelihood (one line each with brief justification)
- Why it matters in this specific codebase (reference the observed code)
- A specific, actionable mitigation (config or code change, not generic advice)

## Rationale
Pattern-based SAST and LLM architectural reasoning are complementary, not substitutes.
The structured pass covers what is mechanically knowable; the free-form pass covers what
requires reasoning across component boundaries.

The constraints were designed to address the known failure modes of unconstrained free-form
security analysis:
- **Hallucination** — addressed by evidence-citation requirement
- **List padding** — addressed by the "report fewer" permission and 7-risk cap
- **Duplication** — addressed by the no-repeat rule with an explicit duplicate definition
- **CVSS inconsistency** — addressed by prohibiting CVSS on hypothesis-level findings
- **Out-of-scope reasoning** — addressed by the scope limitation

The label "LLM-inferred risk hypotheses" is not a disclaimer buried in fine print; it is
the section header. Readers cannot mistake the section for confirmed findings.

## Consequences
- Security skill §3 added; HTML report gains a "Free-form Risk Analysis" section after
  the structured findings table.
- The quality of this section is bounded by what was read during the structured scan.
  A `--pr` scan covering 3 changed files produces limited architectural insights; a
  `--full` scan produces richer ones.
- The free-form pass runs on every scan regardless of scope flag — it adds a fixed
  token cost per scan. This is acceptable given the qualitative value; the structured
  pass dominates the total token cost regardless.
- Findings from this section are not added to the security ledger (no FP fingerprints,
  no `/fix` support). Developers must validate and promote them to ledger entries
  manually if confirmed.

## Revisit when
The structured scan's pattern rules are extended to cover cross-file taint tracking or
data-flow analysis. At that point, the architectural gap that the free-form pass fills
may be substantially closed, making it redundant or reducible to a much narrower prompt.
