#!/bin/bash
# ai-assisted-development plugin — global install script
# Run with: bash install.sh
# Update:   bash install.sh --update
# Uninstall: bash install.sh --uninstall

PLUGIN_NAME="ai-assisted-development"
MARKETPLACE_NAME="ke-marketplace"
MARKETPLACE_DIR="$HOME/.claude/plugins/$MARKETPLACE_NAME"
PLUGIN_DIR="$MARKETPLACE_DIR/plugins/$PLUGIN_NAME"
ADO_REPO_URL="https://dev.azure.com/kirklandandellis/KE/_git/ai-assisted-development"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────────

banner() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Convert Git Bash path to Windows path for Node.js
to_win_path() {
  echo "$1" | sed 's|^/\([a-zA-Z]\)/|\1:/|' | sed 's|/|\\\\|g'
}

# Normalise user-entered path (Windows backslashes → forward slashes)
normalise_path() {
  echo "$1" | sed 's|\\|/|g' | sed 's|^\([A-Za-z]\):|/\L\1|'
}

# Read version from plugin.json — pass path as argument to avoid escaping issues
get_plugin_version() {
  local dir="$1"
  local pj="$dir/.claude-plugin/plugin.json"
  if [ -f "$pj" ] && command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const p = process.argv[1];
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        process.stdout.write(data.version || 'unknown');
      } catch(e) {
        process.stdout.write('unknown');
      }
    " "$pj"
  else
    echo "unknown"
  fi
}

# Write marketplace.json with dynamic version
write_marketplace_json() {
  local version="$1"
  mkdir -p "$MARKETPLACE_DIR/.claude-plugin"
  cat > "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" << MARKETPLACE_EOF
{
  "name": "$MARKETPLACE_NAME",
  "owner": { "name": "Product Engineering" },
  "description": "Kirkland & Ellis internal Claude Code plugins",
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "ICEA-driven development workflow — v$version"
    }
  ]
}
MARKETPLACE_EOF
}

# Ask source — git or local folder. Sets SOURCE_CHOICE.
select_source() {
  local verb="$1"
  echo -e "${CYAN}How would you like to $verb the plugin?${NC}"
  echo ""
  echo "  1) Clone/pull from Azure DevOps (git)"
  echo "     $ADO_REPO_URL"
  echo ""
  echo "  2) Copy from a local folder"
  echo "     (use this if you have the plugin files on your machine)"
  echo ""
  read -p "Enter choice [1/2]: " -n 1 -r SOURCE_CHOICE; echo ""
  echo ""
}

# Validate a local path. Sets LOCAL_PATH and SOURCE_VERSION.
resolve_local_path() {
  local verb="$1"
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  echo "Enter the full path to the folder containing the plugin to $verb."
  echo "  e.g. /c/Users/rawatv/Downloads/ai-assisted-development_V2_1_1"

  # Offer current folder as default if it contains a valid plugin.json
  # and is NOT the already-installed plugin directory (avoid self-copy)
  if [ -f "$SCRIPT_DIR/.claude-plugin/plugin.json" ] && \
     [ "$SCRIPT_DIR" != "$PLUGIN_DIR" ]; then
    echo -e "${YELLOW}  Press Enter to use the current folder: $SCRIPT_DIR${NC}"
    read -p "Path: " LOCAL_PATH
    LOCAL_PATH="${LOCAL_PATH:-$SCRIPT_DIR}"
  else
    read -p "Path: " LOCAL_PATH
    if [ -z "$LOCAL_PATH" ]; then
      echo -e "${RED}✗ No path provided. Please enter the full path to the extracted plugin folder.${NC}"
      exit 1
    fi
  fi

  LOCAL_PATH="$(normalise_path "$LOCAL_PATH")"

  if [ ! -d "$LOCAL_PATH" ]; then
    echo -e "${RED}✗ Folder not found: $LOCAL_PATH${NC}"
    exit 1
  fi
  if [ ! -f "$LOCAL_PATH/.claude-plugin/plugin.json" ]; then
    echo -e "${RED}✗ No plugin.json found in $LOCAL_PATH/.claude-plugin/${NC}"
    echo "  Make sure you're pointing at the ai-assisted-development folder."
    exit 1
  fi

  SOURCE_VERSION=$(get_plugin_version "$LOCAL_PATH")
}

# ── Read currently installed version ──────────────────────────────────────────
INSTALLED_VERSION=$(get_plugin_version "$PLUGIN_DIR")
[ "$INSTALLED_VERSION" = "unknown" ] && INSTALLED_VERSION="not installed"
banner "ai-assisted-development  |  currently installed: v$INSTALLED_VERSION"

# ── Uninstall mode ─────────────────────────────────────────────────────────────
if [[ "$1" == "--uninstall" ]]; then
  echo -e "${YELLOW}Uninstalling $PLUGIN_NAME...${NC}"
  echo ""

  if command -v claude &>/dev/null; then
    echo "  Uninstalling plugin from Claude Code..."
    claude plugin uninstall "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>/dev/null || true
    echo "  Removing marketplace registration..."
    claude plugin marketplace remove "$MARKETPLACE_NAME" 2>/dev/null || true
  else
    echo -e "${YELLOW}  claude CLI not found — skipping plugin uninstall commands.${NC}"
  fi

  if [ -d "$MARKETPLACE_DIR" ]; then
    rm -rf "$MARKETPLACE_DIR"
    echo "  ✓ Deleted $MARKETPLACE_DIR"
  else
    echo -e "${YELLOW}  — Plugin files not found at $MARKETPLACE_DIR, skipping.${NC}"
  fi

  SETTINGS_FILE="$HOME/.claude/settings.json"
  WIN_SETTINGS_FILE="$(to_win_path "$SETTINGS_FILE")"
  if [ -f "$SETTINGS_FILE" ] && command -v node &>/dev/null; then
    node << JSEOF
const fs = require('fs');
const settingsPath = '$WIN_SETTINGS_FILE';
const marketplaceName = '$MARKETPLACE_NAME';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}
if (settings.extraKnownMarketplaces && settings.extraKnownMarketplaces[marketplaceName]) {
  delete settings.extraKnownMarketplaces[marketplaceName];
  if (Object.keys(settings.extraKnownMarketplaces).length === 0) delete settings.extraKnownMarketplaces;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  + Removed extraKnownMarketplaces.' + marketplaceName + ' from settings.json');
} else {
  console.log('  - extraKnownMarketplaces.' + marketplaceName + ' not found, skipping.');
}
JSEOF
  else
    echo -e "${YELLOW}  — settings.json not found or node missing, skipping.${NC}"
  fi

  echo ""
  echo -e "${GREEN}✓ Plugin uninstalled successfully.${NC}"
  echo ""
  echo -e "${YELLOW}Note:${NC} If you stored AZURE_DEVOPS_PAT in .claude/settings.json, remove it"
  echo "  manually — the uninstall does not clear credentials."
  echo "  Also remove the export from ~/.bashrc or ~/.zshrc if you added it there."
  echo ""
  exit 0
fi

# ── Update mode ────────────────────────────────────────────────────────────────
if [[ "$1" == "--update" ]]; then
  if [ ! -d "$PLUGIN_DIR" ]; then
    echo -e "${RED}✗ Plugin not installed. Run bash install.sh first.${NC}"
    exit 1
  fi

  echo -e "${CYAN}Update mode — plugin found at $PLUGIN_DIR${NC}"
  echo ""
  select_source "update"

  case "$SOURCE_CHOICE" in
    1)
      if [ ! -d "$PLUGIN_DIR/.git" ]; then
        echo -e "${RED}✗ Plugin was not installed via git — cannot pull.${NC}"
        echo -e "${YELLOW}  Use option 2 (local folder) to update instead.${NC}"
        exit 1
      fi
      echo -e "  → Pulling from Azure DevOps..."
      cd "$PLUGIN_DIR" && git pull origin main && cd - > /dev/null
      NEW_VERSION=$(get_plugin_version "$PLUGIN_DIR")
      ;;
    2)
      resolve_local_path "install"
      echo ""
      echo -e "  → Source version:   ${CYAN}v$SOURCE_VERSION${NC}"
      echo -e "  → Updating:         v$INSTALLED_VERSION → ${GREEN}v$SOURCE_VERSION${NC}"
      echo ""
      cp -r "$LOCAL_PATH/." "$PLUGIN_DIR"
      NEW_VERSION=$(get_plugin_version "$PLUGIN_DIR")
      ;;
    *)
      echo -e "${RED}✗ Invalid choice.${NC}"
      exit 1
      ;;
  esac

  write_marketplace_json "$NEW_VERSION"

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Plugin updated: v$INSTALLED_VERSION → v$NEW_VERSION${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Start a new Claude Code session to load the updated plugin."
  echo "Then run /dream-sync in each project to update the plugin version."
  echo ""
  exit 0
fi

# ── Preflight checks ───────────────────────────────────────────────────────────
command -v claude &>/dev/null || { echo -e "${RED}✗ Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code${NC}"; exit 1; }
command -v git    &>/dev/null || { echo -e "${RED}✗ git not found. Please install Git and retry.${NC}"; exit 1; }
command -v node   &>/dev/null || { echo -e "${RED}✗ node not found. Please install Node.js and retry.${NC}"; exit 1; }

# ── Handle existing install ────────────────────────────────────────────────────
if [ -d "$PLUGIN_DIR" ]; then
  echo -e "${YELLOW}⚠ Existing install found at $PLUGIN_DIR (v$INSTALLED_VERSION)${NC}"
  echo -e "${YELLOW}  To update an existing install use: bash install.sh --update${NC}"
  read -p "  Overwrite with a fresh install anyway? (y/N) " -n 1 -r; echo ""
  [[ $REPLY =~ ^[Yy]$ ]] && rm -rf "$PLUGIN_DIR" || { echo "Cancelled."; exit 0; }
fi

mkdir -p "$MARKETPLACE_DIR/plugins"

# ── Source selection ───────────────────────────────────────────────────────────
select_source "install"

case "$SOURCE_CHOICE" in
  1)
    echo "Cloning from Azure DevOps..."
    echo "You may be prompted for your ADO credentials."
    echo ""
    git clone "$ADO_REPO_URL" "$PLUGIN_DIR"
    NEW_VERSION=$(get_plugin_version "$PLUGIN_DIR")
    echo ""
    echo -e "  → Installing: ${GREEN}v$NEW_VERSION${NC}"
    ;;
  2)
    resolve_local_path "install"
    echo ""
    echo -e "  → Source version:   ${CYAN}v$SOURCE_VERSION${NC}"
    echo -e "  → Installing:       ${GREEN}v$SOURCE_VERSION${NC}"
    echo ""
    cp -r "$LOCAL_PATH/." "$PLUGIN_DIR"
    NEW_VERSION=$(get_plugin_version "$PLUGIN_DIR")
    ;;
  *)
    echo -e "${RED}✗ Invalid choice. Run the script again and enter 1 or 2.${NC}"
    exit 1
    ;;
esac

# ── Validate ───────────────────────────────────────────────────────────────────
[ ! -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ] && \
  echo -e "${RED}✗ Install failed — plugin.json not found. Check the source and retry.${NC}" && exit 1

# ── Create marketplace wrapper ─────────────────────────────────────────────────
write_marketplace_json "$NEW_VERSION"

# ── Write extraKnownMarketplaces to settings.json ─────────────────────────────
SETTINGS_FILE="$HOME/.claude/settings.json"
[ ! -f "$SETTINGS_FILE" ] && echo "{}" > "$SETTINGS_FILE"

WIN_MARKETPLACE_DIR="$(to_win_path "$MARKETPLACE_DIR")"
WIN_SETTINGS_FILE="$(to_win_path "$SETTINGS_FILE")"

node << JSEOF
const fs = require('fs');
const settingsPath = '$WIN_SETTINGS_FILE';
const marketplaceName = '$MARKETPLACE_NAME';
const winPath = '$WIN_MARKETPLACE_DIR';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}
if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
if (settings.extraKnownMarketplaces[marketplaceName]) {
  console.log('  — extraKnownMarketplaces.' + marketplaceName + ' already exists, skipping.');
} else {
  settings.extraKnownMarketplaces[marketplaceName] = { source: { source: 'directory', path: winPath } };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  ✓ extraKnownMarketplaces.' + marketplaceName + ' registered in settings.json');
}
JSEOF

# ── Clear stale plugin cache ───────────────────────────────────────────────────
CACHE_DIR="$HOME/.claude/plugins/cache"
if [ -d "$CACHE_DIR" ]; then
  echo "Clearing plugin cache..."
  find "$CACHE_DIR" -maxdepth 1 -name "temp_local_*" -type d -exec rm -rf {} + 2>/dev/null || true
fi

# ── Set up ado-helper .env ─────────────────────────────────────────────────────
ADO_ENV_FILE="$PLUGIN_DIR/tools/ado-helper/.env"
ADO_ENV_TEMPLATE="$PLUGIN_DIR/tools/ado-helper/.env.template"

if [ ! -f "$ADO_ENV_FILE" ]; then
  if [ -f "$ADO_ENV_TEMPLATE" ]; then
    cp "$ADO_ENV_TEMPLATE" "$ADO_ENV_FILE"
    echo -e "${GREEN}✓ Created tools/ado-helper/.env${NC} (paste your PAT in ADO_PAT= before use)"
  fi
else
  if ! grep -q "^ADO_PAT=" "$ADO_ENV_FILE"; then
    echo "" >> "$ADO_ENV_FILE"
    echo "ADO_PAT=paste_your_pat_here" >> "$ADO_ENV_FILE"
    echo -e "${YELLOW}⚠ ADO_PAT key added to existing tools/ado-helper/.env${NC} — fill in your token"
  else
    echo -e "${GREEN}✓ tools/ado-helper/.env already configured${NC}"
  fi
fi

# ── Register marketplace and install ──────────────────────────────────────────
echo ""
echo "Registering marketplace and installing plugin..."
echo ""

claude plugin marketplace add "$WIN_MARKETPLACE_DIR"
INSTALL_OUT=$(claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>&1)
INSTALL_EXIT=$?
echo "$INSTALL_OUT"

if [ $INSTALL_EXIT -ne 0 ] || (echo "$INSTALL_OUT" | grep -q "Failed to install" && ! echo "$INSTALL_OUT" | grep -q "installed successfully"); then
  echo ""
  echo -e "${RED}✗ Installation failed — rolling back...${NC}"
  echo ""
  claude plugin uninstall "$PLUGIN_NAME@$MARKETPLACE_NAME" --scope user 2>/dev/null || true
  claude plugin marketplace remove "$MARKETPLACE_NAME" 2>/dev/null || true
  [ -d "$MARKETPLACE_DIR" ] && rm -rf "$MARKETPLACE_DIR"
  echo -e "${RED}✗ Rollback complete. Plugin has been fully removed.${NC}"
  echo ""
  echo -e "${YELLOW}To retry:${NC}"
  echo "  1. Re-run this script — the stale cache has been cleared."
  echo "  2. Check plugin.json: node -e 'require(\"./.claude-plugin/plugin.json\")'"
  echo "  3. If the error persists, run /doctor in Claude Code for details."
  exit 1
fi

# ── Count commands dynamically ─────────────────────────────────────────────────
COMMAND_COUNT=$(find "$PLUGIN_DIR/commands" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

# ── Success ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Plugin installed successfully — v$NEW_VERSION${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "┌─ Next steps ──────────────────────────────────────────────────────────┐"
echo "│                                                                        │"
echo "│  1. Open your project in VS Code                                       │"
echo "│  2. Open a terminal and run: claude                                    │"
echo "│  3. Inside the session, run: /dream-init (new project)                 │"
echo "│                          or: /dream-sync (existing project)            │"
echo "│     dream-sync updates the plugin version in your project files.       │"
echo "│  4. Set AZURE_DEVOPS_PAT as an environment variable                    │"
echo "│     Required by: /pr-create  /sprint-metrics  /app-readiness           │"
echo "│     Add to ~/.bashrc or ~/.zshrc:                                      │"
echo "│       export AZURE_DEVOPS_PAT='your-token-here'                       │"
echo "│  4a. If you store PAT in .claude/settings.json instead, add that       │"
echo "│     file to .gitignore immediately — /dream-status will flag it Red.   │"
echo "│  5. Run /dream-status to verify all infrastructure checks are green    │"
echo "│                                                                        │"
echo "│  Available commands (type / in Claude Code to see all $COMMAND_COUNT):              │"
echo "│  SAVE ICEA  SAVE TECH  APPROVE  IMPLEMENT  REVISE  STATUS             │"
echo "│  dream  dream-status  session-start  icea-feature  code-review         │"
echo "│  checkin  bug  fix  explain  app-readiness  security-review            │"
echo "│                                                                        │"
echo "│  To update later:    bash install.sh --update                         │"
echo "│  To uninstall later: bash install.sh --uninstall                      │"
echo "└────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
