# ai-assisted-development plugin — install / update / uninstall
# Run with: .\install.ps1
# Update:   .\install.ps1 -Update
# Uninstall: .\install.ps1 -Uninstall   (add -Yes to skip the confirmation prompt)

param(
  [switch]$Update,
  [switch]$Uninstall,
  [switch]$Yes
)

$PLUGIN_NAME      = "ai-assisted-development"

# Identity: single source of truth is .claude-plugin/config.json (co-located with
# this script). The plugin ships company-agnostic; on a fresh install the values
# are prompted (Prompt-Identity) and written back to config.json. Never hardcode
# org/project/company here — generic placeholders are the only fallback.
$CONFIG_JSON = Join-Path $PSScriptRoot ".claude-plugin\config.json"
$COMPANY = "Your Company"; $ADO_ORG = "your-org"; $ADO_PROJECT = "your-project"
$ADO_BASE = "https://dev.azure.com"; $ADO_PLUGIN_REPO = $PLUGIN_NAME
if (Test-Path $CONFIG_JSON) {
  try {
    $cfg = Get-Content $CONFIG_JSON -Raw | ConvertFrom-Json
    if ($cfg.company)         { $COMPANY = $cfg.company }
    if ($cfg.organization)    { $ADO_ORG = $cfg.organization }
    if ($cfg.project)         { $ADO_PROJECT = $cfg.project }
    if ($cfg.adoBaseUrl)      { $ADO_BASE = $cfg.adoBaseUrl }
    if ($cfg.pluginRepoName)  { $ADO_PLUGIN_REPO = $cfg.pluginRepoName }
  } catch { }
}

# Marketplace name is DERIVED from the organization: "<org>-marketplace" for a real
# org, else "local-marketplace". Never a hardcoded company name.
function Derive-Marketplace($org) { if ($org -and $org -ne "your-org") { return "$org-marketplace" } else { return "local-marketplace" } }

# Prefer an already-installed plugin dir (any marketplace name) so -Update/-Uninstall
# and overwrite-detection always find it; otherwise derive the name from the org.
$EXISTING_PLUGIN_DIR = Get-ChildItem -Path "$env:USERPROFILE\.claude\plugins\*\plugins\ai-assisted-development" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($EXISTING_PLUGIN_DIR) {
  $PLUGIN_DIR       = $EXISTING_PLUGIN_DIR.FullName
  $MARKETPLACE_DIR  = Split-Path -Parent (Split-Path -Parent $PLUGIN_DIR)
  $MARKETPLACE_NAME = Split-Path -Leaf $MARKETPLACE_DIR
} else {
  $MARKETPLACE_NAME = Derive-Marketplace $ADO_ORG
  $MARKETPLACE_DIR  = "$env:USERPROFILE\.claude\plugins\$MARKETPLACE_NAME"
  $PLUGIN_DIR       = "$MARKETPLACE_DIR\plugins\$PLUGIN_NAME"
}
$ADO_REPO_URL     = "$ADO_BASE/$ADO_ORG/$ADO_PROJECT/_git/$ADO_PLUGIN_REPO"
$SETTINGS_FILE    = "$env:USERPROFILE\.claude\settings.json"
$TEMP_JS          = "$env:TEMP\claude-plugin-setup.js"

# Prompt for identity on a fresh install (Enter keeps the shown default). Re-derives
# the clone URL so a git install uses the entered org/project.
function Prompt-Identity {
  Write-Cyan "Azure DevOps identity - press Enter to keep the shown default (placeholder is fine):"
  $i = Read-Host "  Organization [$script:ADO_ORG]";     if ($i) { $script:ADO_ORG = $i }
  $i = Read-Host "  Project [$script:ADO_PROJECT]";      if ($i) { $script:ADO_PROJECT = $i }
  $i = Read-Host "  Company / team [$script:COMPANY]";   if ($i) { $script:COMPANY = $i }
  $i = Read-Host "  ADO base URL [$script:ADO_BASE]";    if ($i) { $script:ADO_BASE = $i }
  $script:ADO_REPO_URL = "$script:ADO_BASE/$script:ADO_ORG/$script:ADO_PROJECT/_git/$script:ADO_PLUGIN_REPO"
  # Re-derive marketplace name/paths from the entered org — fresh install only.
  if (-not $script:EXISTING_PLUGIN_DIR) {
    $script:MARKETPLACE_NAME = Derive-Marketplace $script:ADO_ORG
    $script:MARKETPLACE_DIR  = "$env:USERPROFILE\.claude\plugins\$script:MARKETPLACE_NAME"
    $script:PLUGIN_DIR       = "$script:MARKETPLACE_DIR\plugins\$script:PLUGIN_NAME"
    Write-Host "  Marketplace: $script:MARKETPLACE_NAME"
  }
  Write-Host ""
}

# Persist entered identity into the installed plugin's config.json, then sync manifests.
function Write-PluginConfig {
  $dest = Join-Path $PLUGIN_DIR ".claude-plugin\config.json"
  if (-not (Test-Path $dest)) { return }
  try {
    $c = Get-Content $dest -Raw | ConvertFrom-Json
    $c.company = $COMPANY; $c.organization = $ADO_ORG; $c.project = $ADO_PROJECT; $c.adoBaseUrl = $ADO_BASE
    ($c | ConvertTo-Json -Depth 10) | Set-Content -Path $dest -Encoding UTF8
    Write-Green "  Identity saved to config.json ($ADO_ORG/$ADO_PROJECT)"
    $sync = Join-Path $PLUGIN_DIR "scripts\sync-config.sh"
    if ((Test-Path $sync) -and (Get-Command bash -ErrorAction SilentlyContinue)) { bash $sync 2>$null | Out-Null }
  } catch { }
}

function Write-Green($msg)  { Write-Host $msg -ForegroundColor Green }
function Write-Yellow($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Red($msg)    { Write-Host $msg -ForegroundColor Red }
function Write-Cyan($msg)   { Write-Host $msg -ForegroundColor Cyan }
function Write-Banner($msg) {
  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Host "  $msg"
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Host ""
}

function Run-NodeScript($script) {
  Set-Content -Path $TEMP_JS -Value $script -Encoding UTF8
  node $TEMP_JS
  Remove-Item -Force $TEMP_JS -ErrorAction SilentlyContinue
}

# Read version from plugin.json — never hardcode it
function Get-PluginVersion($pluginDir) {
  $pjPath = "$pluginDir\.claude-plugin\plugin.json"
  if (Test-Path $pjPath) {
    try {
      $pj = Get-Content $pjPath -Raw | ConvertFrom-Json
      return $pj.version
    } catch { return "unknown" }
  }
  return "unknown"
}

# Ask install/update source — shared between fresh install and -Update
function Select-Source($isUpdate) {
  $verb = if ($isUpdate) { "update" } else { "install" }
  Write-Cyan "How would you like to $verb the plugin?"
  Write-Host ""
  Write-Host "  1) Pull from Azure DevOps (git)"
  Write-Host "     $ADO_REPO_URL"
  Write-Host ""
  Write-Host "  2) Copy from a local folder"
  Write-Host "     (use this if you have the plugin files on your machine)"
  Write-Host ""
  return Read-Host "Enter choice [1/2]"
}

# ── Banner ─────────────────────────────────────────────────────────────────────
$installedVersion = Get-PluginVersion $PLUGIN_DIR
if ($installedVersion -eq "unknown") { $installedVersion = "not installed" }
Write-Banner "ai-assisted-development  |  currently installed: v$installedVersion"

# ── Uninstall mode ─────────────────────────────────────────────────────────────
if ($Uninstall) {
  Write-Yellow "Uninstalling $PLUGIN_NAME..."
  Write-Host ""

  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "  Uninstalling plugin from Claude Code..."
    claude plugin uninstall "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>$null
    Write-Host "  Removing marketplace registration..."
    claude plugin marketplace remove $MARKETPLACE_NAME 2>$null
  } else {
    Write-Yellow "  claude CLI not found — skipping plugin uninstall commands."
  }

  # Clean up global plugin config: cache dirs (all versions), caches orphaned by a
  # marketplace rename/version bumps, and stale extraKnownMarketplaces entries.
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Yellow "  node not found — cannot clean plugin config files."
    Write-Host  "  Install Node.js and re-run, or remove $MARKETPLACE_DIR manually."
    exit 1
  }

  $cleanupJs = Join-Path $PSScriptRoot "scripts\uninstall-cleanup.js"
  # Dry-run first — show exactly what will be removed.
  & node $cleanupJs --plugin $PLUGIN_NAME --marketplace $MARKETPLACE_NAME

  $doApply = $Yes
  if (-not $doApply) {
    $ans = Read-Host "  Proceed with removal? [y/N]"
    if ($ans -match '^[Yy]') { $doApply = $true }
  }

  if (-not $doApply) {
    Write-Host ""
    Write-Yellow "Aborted — nothing removed. Re-run with -Yes to remove without a prompt."
    Write-Host ""
    exit 0
  }

  & node $cleanupJs --plugin $PLUGIN_NAME --marketplace $MARKETPLACE_NAME --apply

  Write-Host ""
  Write-Green "Uninstalled successfully."
  Write-Host ""
  Write-Yellow "Note: If you stored AZURE_DEVOPS_PAT in .claude/settings.json, remove it manually —"
  Write-Host  "  the uninstall does not clear credentials."
  Write-Host ""
  exit 0
}

# ── Update mode ────────────────────────────────────────────────────────────────
if ($Update) {
  if (-not (Test-Path $PLUGIN_DIR)) {
    Write-Red "Plugin not installed. Run .\install.ps1 first."
    exit 1
  }

  Write-Cyan "Update mode — plugin found at $PLUGIN_DIR"
  Write-Host ""

  # Preserve the installed identity — an update copy/pull would otherwise revert
  # config.json to the shipped placeholders.
  $cfgBackup = $null
  $installedCfg = Join-Path $PLUGIN_DIR ".claude-plugin\config.json"
  if (Test-Path $installedCfg) {
    $cfgBackup = [System.IO.Path]::GetTempFileName()
    Copy-Item $installedCfg $cfgBackup -Force
  }

  $choice = Select-Source $true
  Write-Host ""

  switch ($choice) {
    "1" {
      if (-not (Test-Path "$PLUGIN_DIR\.git")) {
        Write-Red "Plugin was not installed via git — cannot pull."
        Write-Yellow "Use option 2 (local folder) to update instead."
        exit 1
      }
      Write-Host "Pulling latest from Azure DevOps..."
      Push-Location $PLUGIN_DIR
      git pull origin main
      Pop-Location
    }
    "2" {
      Write-Host "Enter the full path to the folder containing the new plugin version."
      Write-Host "  e.g. C:\Users\rawatv\Downloads\ai-assisted-development_V2_1_1"
      Write-Yellow "  Do NOT press Enter to use the current folder — point to the extracted zip folder."
      $localPath = Read-Host "Path"

      if ([string]::IsNullOrWhiteSpace($localPath)) {
        Write-Red "No path provided. Please enter the full path to the extracted plugin folder."
        exit 1
      }

      if (-not (Test-Path $localPath)) {
        Write-Red "Folder not found: $localPath"
        exit 1
      }
      if (-not (Test-Path "$localPath\.claude-plugin\plugin.json")) {
        Write-Red "No plugin.json found in $localPath\.claude-plugin\"
        Write-Host "  Make sure you're pointing at the ai-assisted-development folder."
        exit 1
      }

      Write-Host "Copying from $localPath ..."
      Copy-Item -Recurse -Force "$localPath\*" $PLUGIN_DIR
    }
    default {
      Write-Red "Invalid choice."
      exit 1
    }
  }

  $newVersion = Get-PluginVersion $PLUGIN_DIR

  # Restore the preserved identity and re-sync the manifests.
  if ($cfgBackup -and (Test-Path $cfgBackup)) {
    Copy-Item $cfgBackup $installedCfg -Force
    Remove-Item $cfgBackup -Force
    $sync = Join-Path $PLUGIN_DIR "scripts\sync-config.sh"
    if ((Test-Path $sync) -and (Get-Command bash -ErrorAction SilentlyContinue)) { bash $sync 2>$null | Out-Null }
    Write-Green "  Preserved your identity (config.json) across the update"
  }

  # Update marketplace description with new version
  New-Item -ItemType Directory -Force -Path "$MARKETPLACE_DIR\.claude-plugin" | Out-Null
  $winPath = $MARKETPLACE_DIR -replace '\\', '\\\\'
  Set-Content -Path "$MARKETPLACE_DIR\.claude-plugin\marketplace.json" -Encoding UTF8 -Value @"
{
  "name": "$MARKETPLACE_NAME",
  "owner": { "name": "Product Engineering" },
  "description": "$COMPANY internal Claude Code plugins",
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "ICEA-driven development workflow — v$newVersion"
    }
  ]
}
"@

  # Copying the source files alone does NOT change the version Claude loads — it serves
  # from a version-keyed cache dir recorded in installed_plugins.json. Re-read the source
  # marketplace, then update the plugin so the new version is copied into the cache.
  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "  -> Refreshing marketplace metadata in Claude Code..."
    claude plugin marketplace update $MARKETPLACE_NAME 2>$null
    Write-Host "  -> Applying v$newVersion..."
    claude plugin update "$PLUGIN_NAME@$MARKETPLACE_NAME" 2>$null
  } else {
    Write-Yellow "  claude CLI not found — run 'claude plugin update $PLUGIN_NAME@$MARKETPLACE_NAME' manually."
  }

  Write-Host ""
  Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Green "  Plugin updated: v$installedVersion → v$newVersion"
  Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Host ""
  Write-Host "Start a new Claude Code session to load the updated plugin."
  Write-Host "Then run /setup-sync in each project to update the plugin version."
  Write-Host ""
  exit 0
}

# ── Preflight checks ───────────────────────────────────────────────────────────
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Red "Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code"
  exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Red "git not found. Please install Git for Windows and retry."
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Red "node not found. Please install Node.js and retry."
  exit 1
}

# ── Configure identity (prompt on fresh install) ────────────────────────────────
Prompt-Identity

# ── Handle existing install ────────────────────────────────────────────────────
if (Test-Path $PLUGIN_DIR) {
  Write-Yellow "Existing install found at $PLUGIN_DIR (v$installedVersion)"
  Write-Yellow "To update an existing install use: .\install.ps1 -Update"
  $confirm = Read-Host "  Overwrite with a fresh install anyway? (y/N)"
  if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Cancelled."
    exit 0
  }
  Remove-Item -Recurse -Force $PLUGIN_DIR
}

New-Item -ItemType Directory -Force -Path "$MARKETPLACE_DIR\plugins" | Out-Null

# ── Source selection ───────────────────────────────────────────────────────────
$choice = Select-Source $false
Write-Host ""

switch ($choice) {
  "1" {
    Write-Host "Cloning from Azure DevOps..."
    Write-Host "You may be prompted for your ADO credentials."
    Write-Host ""
    git clone $ADO_REPO_URL $PLUGIN_DIR
  }
  "2" {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Write-Host "Enter the full path to the plugin folder."
    Write-Yellow "Press Enter to use the current folder: $scriptDir"
    $localPath = Read-Host "Path"
    if ([string]::IsNullOrWhiteSpace($localPath)) { $localPath = $scriptDir }

    if (-not (Test-Path $localPath)) {
      Write-Red "Folder not found: $localPath"
      exit 1
    }
    if (-not (Test-Path "$localPath\.claude-plugin\plugin.json")) {
      Write-Red "No plugin.json found in $localPath\.claude-plugin\"
      Write-Host "  Make sure you're pointing at the ai-assisted-development folder."
      exit 1
    }

    Write-Host "Copying from $localPath ..."
    Copy-Item -Recurse -Force "$localPath\*" $PLUGIN_DIR
  }
  default {
    Write-Red "Invalid choice. Run the script again and enter 1 or 2."
    exit 1
  }
}

# ── Validate ───────────────────────────────────────────────────────────────────
if (-not (Test-Path "$PLUGIN_DIR\.claude-plugin\plugin.json")) {
  Write-Red "Install failed — plugin.json not found. Check the source and retry."
  exit 1
}

$newVersion = Get-PluginVersion $PLUGIN_DIR

# ── Persist entered identity into the installed plugin's config.json ────────────
Write-PluginConfig

# ── Create marketplace wrapper ─────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path "$MARKETPLACE_DIR\.claude-plugin" | Out-Null

$winPath = $MARKETPLACE_DIR -replace '\\', '\\\\'
Set-Content -Path "$MARKETPLACE_DIR\.claude-plugin\marketplace.json" -Encoding UTF8 -Value @"
{
  "name": "$MARKETPLACE_NAME",
  "owner": { "name": "Product Engineering" },
  "description": "$COMPANY internal Claude Code plugins",
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "ICEA-driven development workflow — v$newVersion"
    }
  ]
}
"@

# ── Write extraKnownMarketplaces to settings.json ─────────────────────────────
if (-not (Test-Path $SETTINGS_FILE)) { Set-Content $SETTINGS_FILE "{}" -Encoding UTF8 }

$jsInstall = @"
const fs = require('fs');
const settingsPath = '$($SETTINGS_FILE -replace '\\', '\\\\')';
const marketplaceName = '$MARKETPLACE_NAME';
const winPath = '$winPath';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}
if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
if (settings.extraKnownMarketplaces[marketplaceName]) {
  console.log('  - extraKnownMarketplaces.' + marketplaceName + ' already exists, skipping.');
} else {
  settings.extraKnownMarketplaces[marketplaceName] = { source: { source: 'directory', path: winPath } };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  + extraKnownMarketplaces.' + marketplaceName + ' registered in settings.json');
}
"@
Run-NodeScript $jsInstall

# ── Clear stale plugin cache ──────────────────────────────────────────────────
$cacheDir = "$env:USERPROFILE\.claude\plugins\cache"
if (Test-Path $cacheDir) {
  Write-Host "Clearing plugin cache..."
  Get-ChildItem $cacheDir -Filter "temp_local_*" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# ── Set up ado-helper .env ─────────────────────────────────────────────────────
$adoEnvFile     = "$PLUGIN_DIR\tools\ado-helper\.env"
$adoEnvTemplate = "$PLUGIN_DIR\tools\ado-helper\.env.template"

if (-not (Test-Path $adoEnvFile)) {
  if (Test-Path $adoEnvTemplate) {
    Copy-Item $adoEnvTemplate $adoEnvFile
    Write-Green "Created tools\ado-helper\.env (paste your PAT in ADO_PAT= before use)"
  }
} else {
  $envContent = Get-Content $adoEnvFile -Raw
  if ($envContent -notmatch '(?m)^ADO_PAT=') {
    Add-Content $adoEnvFile "`r`nADO_PAT=paste_your_pat_here"
    Write-Yellow "ADO_PAT key added to existing tools\ado-helper\.env — fill in your token"
  } else {
    Write-Green "tools\ado-helper\.env already configured"
  }
}

# ── Register marketplace and install ──────────────────────────────────────────
Write-Host ""
Write-Host "Registering marketplace and installing plugin..."
Write-Host ""
claude plugin marketplace add $MARKETPLACE_DIR
# 'add' is a no-op when the marketplace is already registered, leaving Claude with stale
# metadata pointing at the previously-installed version. Force a re-read of the source we
# just refreshed so 'install' below sees the current plugin.json version.
claude plugin marketplace update $MARKETPLACE_NAME 2>$null

$installOutput = claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>&1
$installOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0 -or ($installOutput -match "Failed to install")) {
  Write-Host ""
  Write-Red "Installation failed — rolling back..."
  Write-Host ""
  claude plugin uninstall "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>$null
  claude plugin marketplace remove $MARKETPLACE_NAME 2>$null
  if (Test-Path $MARKETPLACE_DIR) {
    Remove-Item -Recurse -Force $MARKETPLACE_DIR -ErrorAction SilentlyContinue
  }
  Write-Red "Rollback complete. Plugin has been fully removed."
  Write-Host ""
  Write-Yellow "To retry:"
  Write-Host "  1. Re-run this script — the stale cache has been cleared."
  Write-Host "  2. If the error mentions 'author' or 'manifest': ensure you are"
  Write-Host "     using the latest zip from the release page."
  Write-Host "  3. If the error persists, run /doctor in Claude Code for details."
  exit 1
}

# ── Force the current version into Claude's cache ──────────────────────────────
# Claude serves the plugin from a version-keyed cache dir recorded in
# installed_plugins.json — NOT from the marketplace source. When a prior version is
# already installed, the 'install' above is a no-op, so 'update' is what actually copies
# the refreshed version into the cache and rewrites installed_plugins.json. Harmless
# (no-op) on a genuinely fresh install.
claude plugin update "$PLUGIN_NAME@$MARKETPLACE_NAME" 2>$null

# ── Count commands dynamically ────────────────────────────────────────────────
$commandCount = (Get-ChildItem "$PLUGIN_DIR\commands" -Filter "*.md" -ErrorAction SilentlyContinue | Measure-Object).Count

# ── Success ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Green "  Plugin installed successfully — v$newVersion"
Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "┌─ Next steps ──────────────────────────────────────────────────────────┐"
Write-Host "│                                                                        │"
Write-Host "│  1. Open your project in VS Code                                       │"
Write-Host "│  2. Open a terminal and run: claude                                    │"
Write-Host "│  3. Inside the session, run: /setup-init (new project)                 │"
Write-Host "│                          or: /setup-sync (existing project)            │"
Write-Host "│     setup-sync updates the plugin version in your project files.       │"
Write-Host "│  4. Set AZURE_DEVOPS_PAT as a Windows User Environment Variable        │"
Write-Host "│     Required by: /pr-create  /sprint-metrics  /app-readiness           │"
Write-Host "│     Win+S -> 'environment variables' -> User variables -> New          │"
Write-Host "│  4a. If you store PAT in .claude/settings.json instead, add that       │"
Write-Host "│     file to .gitignore immediately — /setup-status will flag it Red.   │"
Write-Host "│  5. Run /setup-status to verify all infrastructure checks are green    │"
Write-Host "│                                                                        │"
Write-Host ("│  Available commands (type / in Claude Code to see all $commandCount):              │")
Write-Host "│  SAVE ICEA  SAVE TECH  APPROVE  IMPLEMENT  REVISE  STATUS             │"
Write-Host "│  dream  setup-status  session-start  icea-feature  code-review         │"
Write-Host "│  checkin  bug  fix  explain  app-readiness  security-review            │"
Write-Host "│                                                                        │"
Write-Host "│  To update later:    .\install.ps1 -Update                            │"
Write-Host "│  To uninstall later: .\install.ps1 -Uninstall                         │"
Write-Host "└────────────────────────────────────────────────────────────────────────┘"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
