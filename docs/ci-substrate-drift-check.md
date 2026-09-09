# CI gate — structural validation + substrate drift-check (node-only)

_ADO-9000 Story 3 (AC-F11). Host-adaptable: the enforcement is the `node` commands; any CI runs them._

No npm dependency — `node` is the only requirement. This runs in the **plugin** repo's CI (not a target
app), so a target being .NET/no-npm is irrelevant.

## The gate (any CI)
    node tests/validate.js                          # 0 failures required
    for t in tests/*.test.cjs; do node "$t"; done   # unit suite

The unit suite includes `substrate-drift.test.cjs`, which vendors the shared substrate, mutates a
vendored copy, and asserts the drift-check exits non-zero — the AC-F11 "CI fails on vendored ≠ canonical"
enforcement, proven deterministically.

## Azure DevOps
`azure-pipelines.yml` at the repo root.

## GitHub Actions (equivalent)
    name: ci
    on: { push: { branches: [ main, dev ] }, pull_request: { branches: [ main, dev ] } }
    jobs:
      validate:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with: { node-version: '20' }
          - run: node tests/validate.js
          - run: |
              set -e
              for t in tests/*.test.cjs; do echo "▶ $t"; node "$t"; done
