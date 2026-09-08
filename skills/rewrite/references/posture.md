# Rewrite — Posture Resolution (AC-F4)

> Loaded by `skills/rewrite/SKILL.md` Step 1. The resolution logic is deterministic in
> `scripts/rewrite-decompose.cjs posture`; this reference is the human-readable rule + question set.
> Design of record: `docs/plans/migrationSkill/rewrite.md` T1.

## Posture follows stack distance — not developer preference

The posture gates the entire rewrite (how much the LLM may assume from the source shape). It is
resolved from the **real distance** between source and target, so it is falsifiable and testable.

| Posture | Condition | What it means |
|---|---|---|
| `port` | **same language AND same framework** | Structure-preserving translation. The source shape is a safe scaffold. |
| `re-architecture` | **any language OR framework change** | Port refused. The source shape is *not* assumed; ask keep-vs-redesign. |
| `rewrite-from-spec` | **no runnable source oracle** (or explicit) | Intent comes from the behavioral inventory / spec — the BAL ceiling applies (see `bal.md`, Inc C). |

`port` is the **only** posture that assumes the source structure carries over. A framework swap in the
same language (e.g. Express→Nest, MVC→Minimal API) is still a `re-architecture` — the programming model
differs even when the language does not.

## Re-architecture question set (keep vs redesign)

When posture is `re-architecture`, ask two things before decomposition — the answers steer options:

1. **Architecture** — keep the existing architecture (structure-preserving), or redesign it for the
   target platform's idioms?
2. **Platform / topology** — keep the current platform/topology, or adopt target-native services?

## Rules

- NEVER offer `port` on a language or framework change — it invites a false "same-shape" assumption.
- A `rewrite-from-spec` posture caps behavioral assurance (no runnable oracle) — surface that ceiling
  in options **before** the developer commits.
- Record the resolved posture in the shared ledger `payload.rewrite.posture`.
