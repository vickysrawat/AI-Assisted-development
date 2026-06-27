# ai-assisted-development plugin — install / update / uninstall
# Run with: .\install.ps1
# Update:   .\install.ps1 -Update
# Uninstall: .\install.ps1 -Uninstall

param(
  [switch]$Update,
  [switch]$Uninstall
)

$PLUGIN_NAME      = "ai-assisted-development"
$MARKETPLACE_NAME = "ke-marketplace"
$MARKETPLACE_DIR  = "$env:USERPROFILE\.claude\plugins\$MARKETPLACE_NAME"
$PLUGIN_DIR       = "$MARKETPLACE_DIR\plugins\$PLUGIN_NAME"
$ADO_REPO_URL     = "https://dev.azure.com/kirklandandellis/KE/_git/ai-assisted-development"
$SETTINGS_FILE    = "$env:USERPROFILE\.claude\settings.json"
$TEMP_JS          = "$env:TEMP\claude-plugin-setup.js"

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

  if (Test-Path $MARKETPLACE_DIR) {
    Remove-Item -Recurse -Force $MARKETPLACE_DIR
    Write-Host "  Deleted $MARKETPLACE_DIR"
  } else {
    Write-Yellow "  Plugin files not found at $MARKETPLACE_DIR, skipping."
  }

  if ((Test-Path $SETTINGS_FILE) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $jsUninstall = @"
const fs = require('fs');
const settingsPath = '$($SETTINGS_FILE -replace '\\', '\\\\')';
const marketplaceName = '$MARKETPLACE_NAME';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}
if (settings.extraKnownMarketplaces && settings.extraKnownMarketplaces[marketplaceName]) {
  delete settings.extraKnownMarketplaces[marketplaceName];
  if (Object.keys(settings.extraKnownMarketplaces).length === 0) {
    delete settings.extraKnownMarketplaces;
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  + Removed ' + marketplaceName + ' from settings.json');
} else {
  console.log('  - ' + marketplaceName + ' not found in settings.json, skipping.');
}
"@
    Run-NodeScript $jsUninstall
  } else {
    Write-Yellow "  settings.json not found or node missing, skipping."
  }

  Write-Host ""
  Write-Green "Uninstalled successfully."
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

  # Update marketplace description with new version
  New-Item -ItemType Directory -Force -Path "$MARKETPLACE_DIR\.claude-plugin" | Out-Null
  $winPath = $MARKETPLACE_DIR -replace '\\', '\\\\'
  Set-Content -Path "$MARKETPLACE_DIR\.claude-plugin\marketplace.json" -Encoding UTF8 -Value @"
{
  "name": "$MARKETPLACE_NAME",
  "owner": { "name": "Product Engineering" },
  "description": "Kirkland and Ellis internal Claude Code plugins",
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "ICEA-driven development workflow — v$newVersion"
    }
  ]
}
"@

  Write-Host ""
  Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Green "  Plugin updated: v$installedVersion → v$newVersion"
  Write-Green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  Write-Host ""
  Write-Host "Start a new Claude Code session to load the updated plugin."
  Write-Host "Then run /dream-sync in each project to update the plugin version."
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

# ── Create marketplace wrapper ─────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path "$MARKETPLACE_DIR\.claude-plugin" | Out-Null

$winPath = $MARKETPLACE_DIR -replace '\\', '\\\\'
Set-Content -Path "$MARKETPLACE_DIR\.claude-plugin\marketplace.json" -Encoding UTF8 -Value @"
{
  "name": "$MARKETPLACE_NAME",
  "owner": { "name": "Product Engineering" },
  "description": "Kirkland and Ellis internal Claude Code plugins",
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
Write-Host "│  3. Inside the session, run: /dream-init (new project)                 │"
Write-Host "│                          or: /dream-sync (existing project)            │"
Write-Host "│     dream-sync updates the plugin version in your project files.       │"
Write-Host "│  4. Set AZURE_DEVOPS_PAT as a Windows User Environment Variable        │"
Write-Host "│     Required by: /pr-create  /sprint-metrics  /app-readiness           │"
Write-Host "│     Win+S -> 'environment variables' -> User variables -> New          │"
Write-Host "│  4a. If you store PAT in .claude/settings.json instead, add that       │"
Write-Host "│     file to .gitignore immediately — /dream-status will flag it Red.   │"
Write-Host "│  5. Run /dream-status to verify all infrastructure checks are green    │"
Write-Host "│                                                                        │"
Write-Host ("│  Available commands (type / in Claude Code to see all $commandCount):              │")
Write-Host "│  SAVE ICEA  SAVE TECH  APPROVE  IMPLEMENT  REVISE  STATUS             │"
Write-Host "│  dream  dream-status  session-start  icea-feature  code-review         │"
Write-Host "│  checkin  bug  fix  explain  app-readiness  security-review            │"
Write-Host "│                                                                        │"
Write-Host "│  To update later:    .\install.ps1 -Update                            │"
Write-Host "│  To uninstall later: .\install.ps1 -Uninstall                         │"
Write-Host "└────────────────────────────────────────────────────────────────────────┘"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
