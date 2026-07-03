# Plugin Test Harness

Validates skill trigger detection, hard rules, and key output patterns without
requiring a full Claude Code session.

## Structure

```
tests/
├── README.md                     ← this file
├── runner.js                     ← Node.js test runner (Anthropic API)
├── validate.py                   ← structural consistency validator (run before release)
├── skill-scenarios/
│   ├── ado-tasks.yaml            ← task breakdown + hard rules
│   ├── app-readiness.yaml        ← 8-domain readiness + missing deployment context
│   ├── architect.yaml            ← deployment questionnaire + no-overwrite rule
│   ├── bug.yaml                  ← lightweight fix flow
│   ├── checkin.yaml              ← pre-commit gate
│   ├── code-review.yaml          ← trigger + scope flags + cache miss
│   ├── dream-rollback.yaml       ← no-log guard + confirmation gate
│   ├── dream-status.yaml         ← infrastructure checks
│   ├── explain.yaml              ← architecture-only Q&A
│   ├── fix.yaml                  ← ledger-based fix application
│   ├── icea-feature.yaml         ← trigger + hard rules + skip-icea
│   ├── icea-review.yaml          ← compliance report
│   ├── plugin-readiness.yaml     ← 6-domain AI readiness + B1-B7 governance
│   ├── pr-create.yaml            ← gate-blocked + confirmation + override
│   ├── pr-describe.yaml          ← scope creep + checklist
│   ├── pr-spec-review.yaml       ← traceability + business override
│   ├── product-docs.yaml         ← ask-first rule + placeholder check
│   ├── security.yaml             ← static asset audit + business override
│   ├── session-start.yaml        ← context warm-up
│   ├── sprint-metrics.yaml       ← KPI report + no-fabrication rule
│   ├── token-analysis.yaml       ← delta cache + skill usage + no-secrets
│   └── update-arch.yaml          ← fingerprint check + deployment flag
└── results/                      ← generated, gitignored
    └── last-run.json
```

## Running tests

```bash
node tests/runner.js                          # run all scenarios
node tests/runner.js --skill icea-feature     # run one skill
node tests/runner.js --verbose                # show full responses
python3 tests/validate.py                     # structural consistency check (no API needed)
python3 tests/validate.py --strict            # treat warnings as errors
```

## Scenario format

```yaml
skill: icea-feature
scenarios:
  - id: trigger-build-verb
    description: "Should trigger on 'build' action verb"
    input: "Build a user search filter for the deals list"
    expect:
      triggered: true
      contains: ["ICEA GATE", "ICEA DRAFT", "APPROVAL REQUIRED"]
      not_contains: ["function", "class", "Controller"]

  - id: hard-rule-no-code-before-approval
    description: "Must not generate code before APPROVED"
    input: |
      Build a search filter.
      APPROVED
    expect:
      triggered: true
      contains: ["APPROVAL REQUIRED"]
      # Code generation only after explicit APPROVED in a second turn
```

## What gets tested

| Category | What | How |
|---|---|---|
| Trigger detection | Does the skill activate on the right phrases? | Input variations → check expected output appears |
| Hard rule: no code before approval | Does skill refuse to generate code? | Multi-turn simulation |
| Hard rule: approval exact word | Does "looks good" NOT count as approval? | Input "looks good" → check APPROVAL REQUIRED still shown |
| Hard rule: no source reads | Does skill stay within declared Category A/B/C? | Check for source-read requests on Category C skills |
| BLOCKED gate | Does pr-create halt on blocked icea-review? | Simulate blocked verdict → check no PR creation |
| Missing deployment context | Does app-readiness stop when no deployment file? | No file → check stop message |
| Cache handling | Does code-review handle missing file-cache gracefully? | No cache file → check first-run behaviour |
| Scope flag parsing | Does --changed / --pr / --full get parsed? | Flag in message → check scope report |
| Business context override | Does B1-B7 data escalate to Critical? | Immigration data → check Critical + B2 |

## validate.py — structural consistency checker

Run this before every release — it takes under 1 second and requires no API key:

```bash
python3 tests/validate.py
```

Checks performed:
- All 22 command stubs present in dream-status check 1d loop and dream-init
- No duplicate step numbers in icea-feature Codebase Orientation
- plugin-readiness check count matches table row count
- architecture-deployment.md referenced in all required files
- Stack contexts read from architecture.md (not hardcoded)
- No inline B1-B7 lists (must reference shared spec)
- No hardcoded ADO org in skill bodies
- dream-health trigger uses hyphen not space
- knowledge-graph schemas present and domain-map-spec removed (ADR 0038)
- source-file-consent.md table contains all skills
- business-context-severity.md referenced in every SKILL.md
- No consecutive --- separators outside frontmatter
- plugin.json skill list matches skills/ folders
- Test scenarios exist for all skills
- CHANGELOG entry exists for current plugin version
- CLAUDE.md has plugin version line

## CI integration

Add to your pre-release checklist:
```bash
python3 tests/validate.py && node tests/runner.js && echo "All checks passed"
```

Set `ANTHROPIC_API_KEY` in your environment. The runner uses `claude-sonnet-4-20250514`
with `max_tokens: 1000` per scenario. Estimated cost: ~$0.02 per full run.

---

## Eval suite as compatibility canary (v1.23.0)

The plugin is coupled to Claude Code's plugin mechanics — the fastest-moving
layer of a young product. The mitigation is not an abstraction layer; it is a
canary:

1. **Pin the Claude Code version** the team runs in team docs.
2. **When a new Claude Code version ships**, run the full eval suite against it
   *before* the team upgrades:
   ```bash
   node tests/runner.js --all
   python3 tests/validate.py
   python3 hooks/validate-ledgers.py
   ```
3. **3/3 variance runs pass** → upgrade is cleared. Any hard-rule scenario
   failing intermittently → hold the upgrade and investigate which mechanic
   shifted (skill loading, memory reads, hook behaviour).

The 34+ behavioural scenarios double as the compatibility test surface: they
exercise skill triggering, gate output, ledger transitions, and hook
interactions — exactly the integration points a platform change would break.
