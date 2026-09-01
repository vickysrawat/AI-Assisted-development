# Secrets Scan — Shared Specification
_Spec version: 1.0 · Last changed: 2026-08-28 · Applies to: checkin, pr-create,
check-settings-secrets.cjs (pattern source)_

Single source of truth for secret / sensitive-file detection. `checkin` (Check C) and
`pr-create` (pre-submit secrets gate) both delegate to this spec rather than implementing
their own patterns. The `check-settings-secrets.cjs` write-time/pre-commit hook derives its
value-shape list from the **Credential value shapes** table below — one list, three consumers.

This is a **HARD, non-skippable gate** in every caller. Unlike the findings gate
(`--skip-security-gate`) and the Feature gate (`/skip-icea`), a positive secret hit has **no
override flag** — a leaked credential is irreversible once pushed. See `write-gate-spec.md`
for gate orthogonality.

---

## What a caller supplies

The spec defines patterns + severity; the **caller supplies the file/content set**:

| Caller | Content scanned | How obtained |
|---|---|---|
| `checkin` | staged + unstaged changes | `git diff --cached` and `git diff` (+ `--name-only` for file globs) |
| `pr-create` | full branch diff | `git diff <base-branch>..HEAD` (+ `--name-only`) |
| `check-settings-secrets.cjs` | `.claude/settings.json` write/staged blob | PreToolUse payload or `git show :.claude/settings.json` |

---

## 1. Sensitive-file globs

A staged/added file whose path matches any glob is a **hard fail** regardless of content.

| Glob | Why |
|---|---|
| `*.env` / `.env*` | environment files hold connection strings + keys |
| `**/settings.json` under `.claude/` | shared/committed — must stay secret-free (hook enforces) |
| `*.pem` `*.key` `*.p12` `*.pfx` | private keys / certificates |
| `*secrets.*` `*credentials.*` | conventionally named secret stores |
| `id_rsa` `id_ecdsa` `id_ed25519` | SSH private keys |

```bash
SENSITIVE_FILE_RE='\.env($|\.)|\.claude/settings\.json$|\.(pem|key|p12|pfx)$|secrets\.|credentials\.|(^|/)id_(rsa|ecdsa|ed25519)$'
```

---

## 2. Credential value shapes  (authoritative list — the .cjs hook mirrors this)

A match anywhere in scanned content is a **hard fail**. Kept byte-aligned with
`check-settings-secrets.cjs` `SECRET_VALUE_RES` — change both together.

| Name | Regex |
|---|---|
| Azure DevOps PAT | `\b[a-z2-7]{52}\b` |
| GitHub PAT (classic) | `\bghp_[A-Za-z0-9]{36}\b` |
| GitHub PAT (fine-grained) | `\bgithub_pat_[A-Za-z0-9_]{22,}\b` |
| AWS access key id | `\bAKIA[0-9A-Z]{16}\b` |
| Slack token | `\bxox[baprs]-[A-Za-z0-9-]{10,}\b` |
| JWT | `\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b` |
| Private key block | `-----BEGIN (?:RSA \|EC \|OPENSSH \|DSA )?PRIVATE KEY-----` |

## 3. Secret-shaped key = value

A secret-shaped KEY assigned a non-placeholder value ≥ 8 chars is a **hard fail**.

```bash
SECRET_KV_RE='(password|passwd|secret|api[_-]?key|apikey|token|bearer|access[_-]?key|private[_-]?key|credential|conn(ection)?string|client[_-]?secret)\s*[:=]\s*['\''"][^'\''"]{8,}'
```

**Placeholder exclusions** (NOT secrets — mirror the hook's `isPlaceholder`): empty; `< 8`
chars; `${VAR}` / `%VAR%` env references; `your-…` / `my_…` / `the-…`; `xxxx…` / `……`;
any of `placeholder|changeme|example|sample|dummy|redacted|todo|tbd|none|null`.

---

## 4. Data-in-static-directory escalation (B1–B7)

Real entity data committed to a web-served static directory (`public/`, `wwwroot/`,
`assets/`, `dist/`, `static/`) is a **Critical** finding under business-context severity
(`business-context-severity.md` B1–B7) — static dirs are publicly served, so this is data
exposure, not just hygiene. Applies to `*.json`/`*.csv`/`*.sql`/`*.xlsx` added under those
paths containing what looks like real records (emails, names, IDs, matter numbers).

```bash
STATIC_DIR_RE='(^|/)(public|wwwroot|assets|dist|static)/.*\.(json|csv|sql|xlsx|xml)$'
```

---

## Canonical bash functions

Copy verbatim into any skill that needs secret detection. Do not write local variants —
changes here must propagate to all callers.

```bash
# Args: newline-separated list of changed file PATHS on stdin.
# Echoes each path that matches a sensitive-file glob or a static-dir data path.
scan_sensitive_paths() {
  grep -iE "$SENSITIVE_FILE_RE" || true
}
scan_static_dir_paths() {
  grep -iE "$STATIC_DIR_RE" || true
}

# Args: diff/content text on stdin. Echoes up to 5 offending lines (value shapes + kv pairs).
# Secret values are matched case-sensitively; kv keys case-insensitively.
scan_secret_content() {
  local text; text="$(cat)"
  {
    printf '%s\n' "$text" | grep -nE \
      '\b[a-z2-7]{52}\b|\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
    printf '%s\n' "$text" | grep -niE "$SECRET_KV_RE"
  } | head -5 || true
}
```

---

## How to invoke

```bash
# checkin — staged + unstaged
changed=$(git diff --name-only --cached; git diff --name-only)
sens=$(printf '%s\n' "$changed" | scan_sensitive_paths)
data=$(printf '%s\n' "$changed" | scan_static_dir_paths)
hits=$( { git diff --cached; git diff; } | scan_secret_content )

# pr-create — full branch diff against the resolved base branch
changed=$(git diff --name-only "$base".."HEAD")
sens=$(printf '%s\n' "$changed" | scan_sensitive_paths)
data=$(printf '%s\n' "$changed" | scan_static_dir_paths)
hits=$(git diff "$base".."HEAD" | scan_secret_content)
```

`fail = [ -n "$sens" ] || [ -n "$hits" ] || [ -n "$data" ]`.

---

## Result structure

| Variable | Meaning | Severity on match |
|---|---|---|
| `sens` | sensitive files staged/added | ❌ hard fail (blocks) |
| `hits` | secret value shapes / key=value pairs in content | ❌ hard fail (blocks) |
| `data` | real data under a static-served dir | ❌ Critical (B1–B7), blocks |

---

## Output blocks by caller

### `checkin` — Check C (hard fail)

```
C. Secrets  ❌ FAIL
  Sensitive file staged : {file}
    Fix: git reset HEAD {file} && echo "{file}" >> .gitignore
  Secret pattern         : {file}:{line} — {matched shape}
    Fix: remove the value; use an env var or settings.local.json
  Data in static dir     : {file} — real entity data (Critical, B1–B7)
    Fix: git reset HEAD {file} && git rm {file}
         (purge history if previously committed: git filter-repo --path {file} --invert-paths)
```

### `pr-create` — pre-submit secrets gate (hard, no override)

```
❌ BLOCKED — secrets detected in branch diff; PR not created.
  {file}:{line} — {matched shape}
  Remove the secret and amend the branch before re-running /pr-create.
  This gate has no bypass flag — a pushed credential is already compromised.
```

---

## Rules

- HARD gate — a positive hit blocks in EVERY caller; there is **no** skip flag (unlike
  `--skip-security-gate` / `--skip-icea`). Rotate any real credential that reaches a diff.
- NEVER echo or log the matched credential value beyond the truncated line needed to locate it.
- Placeholder / env-reference values are NOT secrets — apply the §3 exclusions to avoid false positives.
- The **Credential value shapes** table (§2) is the single source; `check-settings-secrets.cjs`
  `SECRET_VALUE_RES` MUST stay byte-aligned with it — change both in the same commit.
- If a file is both sensitive-glob and content-hit, report once (glob takes precedence).
- Missing/binary files → skip silently, never error.
