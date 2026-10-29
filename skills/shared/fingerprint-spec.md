# Finding Fingerprint Specification
_Spec version: 1.1 · Last changed: 2026-10-28 · Applies to: code-review, security, dynamic-scan · 1.1: eligibility decided by scripts/finding-verify.cjs; IDs must be computed (hash algorithm unchanged)_

Shared by: `code-review`, `security`, `dynamic-scan`

Defines the canonical algorithm for generating deterministic fingerprints for
scan findings. Fingerprints enable the `/fix` and `/dismiss` workflows and
persistent ledger tracking across scans.

---

## Format

```
FP-{first 8 hex chars of SHA-1}
```

Example: `FP-a1b2c3d4`

---

## Generation algorithm

The fingerprint is a SHA-1 hash of a pipe-delimited string:

```
input = "{checker_or_vuln_type}|{file}|{category}|{short_description}"
fingerprint = "FP-" + SHA1(input).hex().slice(0, 8)
```

### Using Node.js (preferred — available in all project environments)

```bash
node -e "console.log('FP-' + require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,8))" \
  "TAINTED_SQL|UserRepository.cs|SQL injection|user input concatenated into query"
```

### Using bash (fallback)

```bash
echo -n "TAINTED_SQL|UserRepository.cs|SQL injection|user input concatenated into query" \
  | sha1sum | cut -c1-8 | sed 's/^/FP-/'
```

---

## Input fields

| Field | Source (code-review) | Source (security) | Source (dynamic-scan) |
|---|---|---|---|
| `checker_or_vuln_type` | Checker name (e.g. `TAINTED_SQL`) | Vulnerability type (e.g. `SQLI`) | ZAP alert name |
| `file` | File path relative to project root | File path relative to project root | URL path or source file |
| `category` | Checker category (e.g. `SQL injection`) | OWASP category | ZAP risk category |
| `short_description` | One-line description of the defect | One-line description of the vulnerability | ZAP alert description |

---

## Collision check

After computing each fingerprint, verify it does not already exist in the
ledger with **different content** (different file or different vulnerability type).

If a collision is detected, append a counter suffix:
- `FP-a1b2c3d4` (first occurrence)
- `FP-a1b2c3d4b` (second, if collision)
- `FP-a1b2c3d4c` (third, if another collision)

Collisions are rare but silent when undetected — always check.

---

## What gets a fingerprint

Eligibility is decided by `scripts/finding-verify.cjs check`, not by judgement — its
`verdict` field is authoritative. (code-review and security — including its IaC and SCA
sub-agents — run it before every ledger write; dynamic-scan has not adopted it yet — until it
does, apply the same conditions by hand.) SCA dependency findings (`kind: "dependency"`) are
checked differently: the vulnerable `package@version` must be declared in the cited manifest, and
the fix is a version upgrade rather than a paste.

| Verdict | Condition (all checked against the real file) | Ledger section |
|---|---|---|
| `fingerprint` | Vulnerable snippet exists verbatim and once in the file; fix has no `...` placeholders, is code (not a comment), uses only existing / self-defined / declared-external names, passes only real keyword args, and (where a parser exists) leaves the file parsable | `## Open Findings` (FP ID) |
| `needs-confirmation` | As `fingerprint`, but the defect depends on an unconfirmed business intent or reachability (`needs_confirmation` question supplied) | `## Needs-Confirmation Findings` (FP ID, never gates) |
| `manual-fix-required` | Snippet verified, but the fix is missing, prose, pseudocode, invents names, or breaks the syntax | `## Manual-Fix-Required Findings` (no FP ID) |
| `requote` | Snippet is not verbatim, not unique, or the file is missing — re-quote from the file and re-run, or drop the finding | not written until resolved |

Advisory-only findings (e.g. "consider adding rate limiting") are `manual-fix-required`
and are excluded from the `/fix` workflow.

---

## Stability

The fingerprint is stable across scans as long as the input fields do not
change. This means:
- Renaming a file changes the fingerprint (new finding, old one marked Fixed)
- Changing the checker/vuln_type changes the fingerprint
- Changing the description changes the fingerprint

This is intentional — a renamed file or reclassified finding should be
re-evaluated, not silently carried forward.

---

## Hard rules

- **IDs are computed, never typed.** Take the `fp` from `finding-verify.cjs check`
  output (it hashes the four input fields and applies the collision suffix when given
  `--ledger`). An ID typed by a model or a person — e.g. `FP-a1b2c3d4`, `FP-e9f0a1b2` — cannot
  be reproduced, so a later scan can never re-confirm it. `finding-verify.cjs audit-ledger`
  reports such IDs as `suspect-hand-assigned`; keep the ID (it may be referenced elsewhere)
  but add `- **Provenance**: legacy-unverified (hand-assigned)` to the block.
- **Always check for collisions** before writing to the ledger.
- **Never generate fingerprints for advisory-only findings.** Use
  `manual-fix-required` instead.
- **Never modify the algorithm.** If the hashing needs to change, bump the spec
  version and add a migration note.
- **Fingerprints are case-sensitive.** `FP-A1B2C3D4` and `FP-a1b2c3d4` are
  different (but the algorithm always produces lowercase).
