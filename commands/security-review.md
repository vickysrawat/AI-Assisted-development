---
description: Security review — scans codebase for OWASP, CWE, and IaC vulnerabilities. Writes HTML report to security/ and updates security/security-ledger.md with FP-fingerprinted findings. Use /fix FP-xxxxxxxx to apply remediations. Flags: --pr (git diff, PR changes only), --changed (git diff, uncommitted changes), --full (entire working tree, no limit), --ci, --area, --continue.
argument-hint: [--changed | --pr | --full | --ci]
---

# /security-review

Read `skills/security/SKILL.md` and execute it completely from Step 0 to the end.
Pass the scope flag from the user's invocation directly into the skill's Step 0b.

---

## Step 0 — Resolve and lock scope flag

Parse the invocation arguments and set SCOPE_FLAG to exactly one of:

| User typed | SCOPE_FLAG |
|---|---|
| `--full` | `--full` |
| `--ci` | `--ci` |
| `--changed` | `--changed` |
| `--pr` | `--pr` |
| (nothing) | (default — cache-aware) |

> ⚠ If SCOPE_FLAG is `--full` or `--ci`:
> The cache must NOT be consulted. Every file from `find` is scanned. No file skipped.
>
> ⚠ If SCOPE_FLAG is `--area <name>` or `--continue`:
> Use the targeted file list from Step 0b. Budget cap does NOT apply.
> These flags are sub-scan modes — developer has explicitly chosen a smaller scope.

Announce the resolved flag before doing anything:
```
🛡 Security Review — scope: {SCOPE_FLAG or "default (cache-aware)"}
```

---

## Step 1 — Announce scan intent before reading any file

Before the skill reads a single source file, output this announcement:

```
🔍 Security Review — source file scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mode    : {SCOPE_FLAG or "default (cache-aware)"}
  Will read: {N} files from project root
  Why     : Scanning for vulnerabilities across OWASP Top 10, CWE patterns,
            IaC misconfigurations, and compliance gaps. Static asset
            directories (public/, wwwroot/) checked first for exposed data.
  Token cost: ~{estimated tokens based on file count and average size}

Proceeding with scan. Type STOP at any time to halt.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This is a Category A consent (implicit — developer invoked the command).
No confirmation prompt is needed. The announcement makes the scan transparent.

## Step 2 — Execute the security skill in full

Read `skills/security/SKILL.md` and follow every step exactly.

When you reach **Step 0b** in the skill, use SCOPE_FLAG resolved above.
When you reach **Step 0c** in the skill, run the `find .` command exactly as written —
scanning from the project root, not from `src/`.
When you reach **Step 0d** in the skill:
- If SCOPE_FLAG is `--full` or `--ci` → skip the cache entirely, scan all files
- If SCOPE_FLAG is `--changed` or `--pr` → use the git diff file list, skip cache
- If no flag → apply cache comparison as normal

Do not re-implement scope logic here. Use what the skill defines.

Create the security folder if it does not exist:
```bash
mkdir -p security
```

---

## Step 3 — Write the HTML report

After the skill completes its analysis, write a self-contained HTML report to
`security/security-review-<date>.html`. Use the structure defined in
`skills/security/references/output-formats.md`.

```bash
!node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
const filename = 'security/security-review-' + date + '.html';
const html = String.raw\`REPLACE_WITH_FULL_HTML\`;
fs.writeFileSync(filename, html, 'utf8');
console.log('Written: ' + filename);
"
```

The HTML must be fully self-contained (inline CSS, no external requests, no JS
dependencies). It must include every finding with its severity, CVSS, CWE, file
location, vulnerable snippet, and recommended fix. Step 0f2 in the skill also
writes `security/security-ledger.md` — the HTML report and the ledger are both
written as separate but parallel deliverables.

---

## Step 4 — Confirm

```
Security review complete → security/security-review-<date>.html

Scope    : {SCOPE_FLAG or "default (cache-aware)"}
Scanned  : N files  (M skipped by cache — or "0 skipped (--full mode)")

Health score: N/100  [GREEN / AMBER / RED]

Findings:
  Critical: N
  High:     N
  Medium:   N
  Low:      N
  Info:     N

Top 3 issues:
1. [title] — [location] — CVSS N.N  (CWE-XXX)
2. [title] — [location] — CVSS N.N  (CWE-XXX)
3. [title] — [location] — CVSS N.N  (CWE-XXX)

Ledger : security/security-ledger.md updated
         {N fixable findings with FP-fingerprint IDs | no new fixable findings}
         {M manual-fix-required findings (infra/advisory — no auto-fix)}

Next steps:
  /fix FP-xxxxxxxx         — apply a specific fix directly to source
  /security-review --full  — re-scan after fixes to verify
  /checkin                 — gates on open Critical/High before commit
```
