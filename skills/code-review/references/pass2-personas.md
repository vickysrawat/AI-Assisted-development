# Code Review Skill — Pass 2 Persona Definitions
_Loaded during Pass 2 of the three-pass scan architecture._

---

## Purpose

Pass 2 runs focused expert reviews that catch what deterministic checkers miss.
Each persona reasons about patterns, interactions, and design — not just syntax.
They are the equivalent of specialized code reviewers who each bring a different
lens to the same codebase.

All personas are subordinate to `../../shared/personas-spec.md` guardrails:
- Lens, not roleplay. Never write in-character.
- Stack-agnostic. Expertise is the project's detected stack.
- Governance subordination. A persona's "experience" is never evidence.
- Never name the persona in findings.

---

## De-duplication gate (mandatory for every persona)

Before each persona begins, inject the Pass 1 findings summary and all prior
persona findings. The instruction is:

```
DO NOT re-report any finding that covers the same file + defect class
combination as a Pass 1 or prior persona finding. Only report findings that
add NEW information.
```

See `../../shared/three-pass-spec.md` section Pass 2 for the full de-duplication
protocol and persona ordering rules.

---

## Persona Roster

### P1. Reliability Engineer

Lens: "What fails at runtime, and how does the system behave when it does?"

Looks for:
- Error propagation chains — exceptions swallowed in one layer that cause
  silent failures or misleading behavior in another
- Missing or incorrect retry/timeout logic on external calls
- Graceful degradation gaps — what happens when a dependency is unavailable?
- Partial failure modes — transactions that half-complete, leaving inconsistent state
- Recovery paths — can the system recover from each failure mode without manual intervention?
- Observable failure — are errors logged/surfaced, or do they disappear silently?

Does NOT look for:
- Individual null reference checks (covered by Pass 1 NULL_RETURNS)
- Individual swallowed exceptions (covered by Pass 1 SWALLOWED_EXC)
- Individual missing return checks (covered by Pass 1 CHECKED_RETURN)

Evidence rule: Every finding must cite at least two code locations showing how
a failure in one place propagates (or fails to propagate) to another. Single-
point error handling issues belong in Pass 1.

Max findings: 5

---

### P2. Concurrency Specialist

Lens: "What breaks under concurrent access, and where is shared state unprotected?"

Looks for:
- Race conditions between components that share state (not just within one method)
- Deadlock potential from lock ordering across multiple classes
- Async/await pitfalls — blocking on async, missing ConfigureAwait, fire-and-forget
- Shared mutable state across requests, sessions, or threads
- Thread-safety assumptions in dependency injection scopes (singleton vs scoped)
- Event ordering assumptions that break under concurrent load
- Missing atomic operations where multiple reads/writes should be transactional

Does NOT look for:
- Individual RACE_CONDITION patterns within one method (covered by Pass 1)
- Individual DEADLOCK patterns (covered by Pass 1)
- Individual THREAD_LEAKED patterns (covered by Pass 1)

Activation gate: This persona ONLY activates if the codebase has concurrency
signals:
- Multi-threaded code (async/await, Task, Thread, locks, mutexes)
- Background job processing
- Event-driven architecture (message queues, event handlers)
- Shared state patterns (singletons, static fields, caches)

If no concurrency signals are detected, skip and announce:
"P2 (Concurrency Specialist): skipped — no concurrency patterns detected."

Max findings: 5

---

### P3. API Contract Reviewer

Lens: "Where do components disagree on their contracts, and where are boundaries unvalidated?"

Looks for:
- Interface misuse — calling APIs with wrong assumptions about null, empty, or error returns
- Breaking contract changes — methods that changed behavior without updating callers
- Missing validation at system boundaries (API endpoints, file I/O, external service calls)
- Type safety gaps — implicit casts, any types, dynamic typing at integration points
- Inconsistent error contracts — some methods throw, others return null, others return Result
- N+1 query patterns that emerge from how services call repositories
- Missing pagination on endpoints that could return unbounded results

Does NOT look for:
- Individual BAD_COMPARE or INCOMPATIBLE_CAST patterns (covered by Pass 1)
- Individual API misuse within one function (covered by Pass 1)

Evidence rule: Every finding must identify both sides of the contract — the
provider and the consumer — and explain the mismatch. Single-side findings
belong in Pass 1.

Max findings: 5

---

## Output format for Pass 2 findings

Each persona finding follows this format:

```
### P{N}-{seq} — {Plain-language title}

Persona: P{N} ({persona name})
Checker: PERSONA_{category} (e.g., PERSONA_RELIABILITY, PERSONA_CONCURRENCY)
Impact: {Critical | High | Medium | Low}

{Plain prose: what the code does, why it's a defect, what happens at runtime.
Reference actual files and functions. 2-4 sentences.}

Event path:
  Event 1 [{role}]: {file}:{function} — {what happens here}
  Event 2 [{role}]: {file}:{function} — {how it connects}

Vulnerable code:
  {snippet from the problematic interaction}

Fix:
  {corrected code showing the proper interaction}
```

---

## Adding or removing personas

To add a new persona:
1. Define it in this file following the template above
2. Give it a clear "Looks for" / "Does NOT look for" boundary
3. Update the persona ordering in the SKILL.md
4. Ensure no overlap with existing personas or Pass 1 checkers

To temporarily disable a persona, use the activation gate pattern shown in P2.
