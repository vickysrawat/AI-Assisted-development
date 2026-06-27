---
description: Dynamic (DAST) security scan against a running web app or API using OWASP ZAP via Docker. Writes HTML report to dynamic-scan/ and updates dynamic-scan/dynamic-scan-ledger.md with FP-fingerprinted source-level findings. Use /fix FP-xxxxxxxx to apply remediations. Flags: --url, --stack, --auth, --swagger, --scope, --deps-only, --full, --diff, --ci, --fail-on.
argument-hint: [--url <target>] [--stack mvc|api|angular|blazor|razorpages] [--auth none|form|token|azure|windows] [--swagger <path>] [--scope <path>] [--deps-only] [--full] [--diff] [--ci] [--fail-on <sev>]
---

# /dynamic-scan

Read `skills/dynamic-scan/SKILL.md` and execute it completely from Step 0 to the end.
Pass the invocation flags into the skill's Step 0d.

This is the runtime (DAST) counterpart to `/security-review` (static SAST). Use
`/security-review` to scan source code; use `/dynamic-scan` to scan a running target.

---

## Step 0 — Resolve and lock flags

Parse the invocation and set:

| User typed | Effect |
|---|---|
| `--url <target>` | Live target. Required unless `--deps-only`. |
| `--stack <type>` | Override auto-detection. |
| `--auth <type>` | none / form / token / azure / windows. |
| `--swagger <path>` | API: import spec, skip spider. |
| `--scope <path>` | Active scan limited to a path (implies attack payloads). |
| `--deps-only` | Dependency audit only — no live scan, always safe. |
| `--full` | Full active scan (attack payloads) — requires Step 0a confirmation. |
| `--diff` | Report only findings new since last run. |
| `--ci` | Headless, no prompts, JSON+HTML, bare image. |
| `--fail-on <sev>` | Non-zero exit if any finding ≥ severity. |
| (nothing) | Default: passive baseline scan + dependency audit (no attack payloads). |

Announce the resolved configuration before doing anything:
```
🛡 Dynamic Scan — target: {URL or "deps-only"} · scope: {passive | active} · stack: {detected/override}
```

> ⚠ If the scan is active (`--full` or `--scope`): the skill's Step 0a authorisation gate
> MUST pass (not production + authorised) before any payload is sent. If the user names a
> production host for an active scan, refuse.

---

## Step 1 — Execute the dynamic-scan skill in full

Read `skills/dynamic-scan/SKILL.md` and follow every step exactly:
pre-flight (Docker, stack detection, HTTPS cert, Windows-auth check) → auth setup + the
`stats.auth.state.loggedin` verification gate → route discovery → generate and run the ZAP
Automation Framework `zap-plan.yaml` → parse/baseline/severity/diff → source-mapped fixes.

Do not re-implement scope logic here. Use what the skill defines.

---

## Step 2 — Create the output folder

```bash
mkdir -p dynamic-scan
```

---

## Step 3 — Write the HTML report

After the skill completes its analysis, write the self-contained report to
`dynamic-scan/dynamic-scan-<date>.html` using the structure in
`skills/dynamic-scan/references/report-format.md`.

---

## Step 4 — Cleanup (mandatory)

ZAP session/context files can hold plaintext credentials. Remove them and the generated plan:
```bash
rm -f dynamic-scan/*.session dynamic-scan/*.context dynamic-scan/zap-plan.yaml 2>/dev/null || true
```

---

## Step 5 — Confirm

```
Dynamic scan complete → dynamic-scan/dynamic-scan-<date>.html

Target   : {URL}   Stack: {detected}   Scan: {passive | active}
Auth     : {type}  (verified: {yes/no})

Findings : Critical N · High N · Medium N · Low N · Info N
Deps     : vulnerable N (direct N, transitive N)

Top 3:
1. [title] — [url/param] — CVSS N.N (CWE-XXX) → [file:line]
2. ...
3. ...
```
