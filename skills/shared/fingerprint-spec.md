# Finding Fingerprint Specification
_Spec version: 1.0 · Last changed: 2026-07-06 · Applies to: code-review, security, dynamic-scan_

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

Only findings with a **concrete source-level fix** qualify:

| Has fingerprint | Condition |
|---|---|
| Yes | Specific file + vulnerable code snippet + corrected code snippet |
| No | Advisory-only findings (e.g. "consider adding rate limiting") |

Advisory-only findings get `manual-fix-required` in place of an FP ID and are
excluded from the `/fix` workflow. They still appear in the ledger under
`## Manual-Fix-Required Findings`.

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

- **Always check for collisions** before writing to the ledger.
- **Never generate fingerprints for advisory-only findings.** Use
  `manual-fix-required` instead.
- **Never modify the algorithm.** If the hashing needs to change, bump the spec
  version and add a migration note.
- **Fingerprints are case-sensitive.** `FP-A1B2C3D4` and `FP-a1b2c3d4` are
  different (but the algorithm always produces lowercase).
