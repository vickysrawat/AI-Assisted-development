#!/usr/bin/env pwsh
# hooks/icea-floor.ps1 — PreToolUse hook: mechanical ICEA floor (PowerShell port of icea-floor.sh)
#
# Fallback when bash is unavailable. Behaviour is identical to icea-floor.sh.
# Invoked by dispatch.ps1 — do not call directly from settings.json.
#
# Exit 0 = allow, exit 2 = block (stderr message is shown to the model).

$ErrorActionPreference = 'Continue'

$stdinContent = [Console]::In.ReadToEnd()

# Parse file_path from the hook JSON payload
$filePath = ''
try {
    $payload   = $stdinContent | ConvertFrom-Json
    $filePath  = [string]$payload.tool_input.file_path
} catch {
    exit 0  # Unparseable payload — allow
}

if ([string]::IsNullOrWhiteSpace($filePath)) { exit 0 }

# Normalize backslashes to forward slashes (Windows path compatibility)
$filePath = $filePath -replace '\\', '/'

# Exempt paths — docs, markdown, memory, .claude config, json/yaml/yml, gitignore,
# tests, plugin HTML guides, prod-readiness. Order mirrors the .sh case statement.
$exemptPatterns = @(
    '(^|.*/)docs/',
    '\.md$',
    '(^|.*/)memory/',
    '(^|.*)/.claude/',
    '\.(json|yaml|yml|gitignore)$',
    '(^|.*/)tests/',
    '(^|.*/)plugin-guide\.html$',
    '^plugin-guide\.html$',
    '(^|.*/)user-guide\.html$',
    '^user-guide\.html$',
    '(^|.*/)prod-readiness/',
    '^prod-readiness/'
)
foreach ($pattern in $exemptPatterns) {
    if ($filePath -match $pattern) { exit 0 }
}

# Guard only source extensions — everything else is allowed
$guardedExts = @('.cs', '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.html', '.css', '.scss', '.sql')
$ext = [System.IO.Path]::GetExtension($filePath).ToLower()
if ($ext -notin $guardedExts) { exit 0 }

# Floor predicate: an ICEA file with Status: Approved or Tier: T1 modified in the last 8 hours
$cutoff = (Get-Date).AddMinutes(-480)
if (Test-Path 'docs') {
    $recentIceas = Get-ChildItem -Recurse -File -Path 'docs' -ErrorAction SilentlyContinue |
                  Where-Object { $_.Name -like '*.icea.md' -or $_.Name -like 'ADO-*.md' -or $_.Name -like 'icea-*.md' } |
                  Where-Object { $_.LastWriteTime -gt $cutoff }

    foreach ($f in $recentIceas) {
        $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -match 'Status:.*Approved|Tier:\s*T1') {
            exit 0  # Floor satisfied
        }
    }
}

[Console]::Error.WriteLine(
    "ICEA FLOOR: blocked write to $filePath — no approved ICEA (or T1 auto-ICEA) found modified " +
    "in the last 8h under docs/. Create and approve an ICEA first (/icea-feature), or if one " +
    "exists, touch it to confirm it is current. This is the mechanical floor beneath the ICEA gate."
)
exit 2
