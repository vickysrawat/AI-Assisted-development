#!/usr/bin/env pwsh
# hooks/findings-gate-precommit.ps1 — git pre-commit hook: findings gate (PowerShell port of findings-gate-precommit.sh)
#
# Fallback when bash is unavailable. Behaviour is identical to findings-gate-precommit.sh.
# Called from findings-gate-precommit-shim.sh (the actual .git/hooks/pre-commit entry point).
#
# Override: $env:SKIP_FINDINGS_GATE = '1'  (logged to stderr, visible in CI)

if ($env:SKIP_FINDINGS_GATE -eq '1') {
    [Console]::Error.WriteLine('⚠️  findings-gate: SKIPPED via SKIP_FINDINGS_GATE=1 — record your justification in the commit message')
    exit 0
}

# Secret guard for the shared .claude/settings.json
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path '.claude/hooks/check-settings-secrets.cjs')) {
    & node '.claude/hooks/check-settings-secrets.cjs' '--staged'
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('')
        [Console]::Error.WriteLine('Commit blocked by settings-secret-guard. Override (with a written justification')
        [Console]::Error.WriteLine('in the commit message) via: SKIP_FINDINGS_GATE=1 git commit ...')
        exit 1
    }
}

$ledgers = @(
    'CodeReviews/code-review-ledger.md',
    'security/security-ledger.md',
    'dynamic-scan/dynamic-scan-ledger.md'
)

$total  = 0
$detail = @()

foreach ($ledger in $ledgers) {
    if (-not (Test-Path $ledger)) { continue }

    $content = Get-Content $ledger -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    # Extract the ## Open Findings section (up to the next ## heading or end of file)
    $openSection = ''
    if ($content -match '(?s)## Open Findings\r?\n(.*?)(\r?\n## |\z)') {
        $openSection = $Matches[1]
    }

    # Count Critical/High findings — mirrors the grep in .sh:
    # ^### [FP-<hex>] <title> (Critical|High)$
    $count = ([regex]::Matches(
        $openSection,
        '^### \[FP-[a-f0-9]+[a-z]?\] .+ (Critical|High)$',
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )).Count

    if ($count -gt 0) {
        $total += $count
        $detail += "  ${ledger}: $count open Critical/High"
    }
}

if ($total -gt 0) {
    [Console]::Error.WriteLine("❌ findings-gate: commit blocked — $total open Critical/High finding(s):")
    foreach ($d in $detail) { [Console]::Error.WriteLine($d) }
    [Console]::Error.WriteLine('')
    [Console]::Error.WriteLine('Resolve with /fix FP-xxxxxxxx, dismiss with justification via /dismiss,')
    [Console]::Error.WriteLine('or override with SKIP_FINDINGS_GATE=1 and a written justification in the commit message.')
    exit 1
}

exit 0
