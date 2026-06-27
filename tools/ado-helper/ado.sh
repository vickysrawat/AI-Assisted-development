#!/usr/bin/env bash
# ============================================================
# ado.sh  —  Safe ADO API helper
# Usage:
#   source ado.sh          (loads config, exports ADO_AUTH)
#   ado_get_item 81469     (fetch a work item)
#   ado_get_item 81469 relations   (fetch with relations expanded)
# ============================================================

# ── Config ──────────────────────────────────────────────────
# Load from .env file in the same directory as this script
_ADO_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_ADO_ENV_FILE="$_ADO_SCRIPT_DIR/.env"

if [[ ! -f "$_ADO_ENV_FILE" ]]; then
  echo "[ado.sh] ERROR: .env file not found at $_ADO_ENV_FILE"
  echo "         Copy .env.template to .env and fill in your PAT."
  return 1 2>/dev/null || exit 1
fi

# Source only the keys we expect — never eval the whole file
ADO_ORG=$(grep '^ADO_ORG=' "$_ADO_ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
ADO_PROJECT=$(grep '^ADO_PROJECT=' "$_ADO_ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
_ADO_PAT=$(grep '^ADO_PAT=' "$_ADO_ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [[ -z "$_ADO_PAT" || -z "$ADO_ORG" || -z "$ADO_PROJECT" ]]; then
  echo "[ado.sh] ERROR: ADO_ORG, ADO_PROJECT, and ADO_PAT must all be set in .env"
  return 1 2>/dev/null || exit 1
fi

# Build auth header once — PAT never appears again after this line
ADO_AUTH=$(printf ':%s' "$_ADO_PAT" | base64 -w 0)
unset _ADO_PAT   # scrub the raw PAT from memory immediately

export ADO_ORG ADO_PROJECT ADO_AUTH

echo "[ado.sh] Loaded. Org=$ADO_ORG  Project=$ADO_PROJECT  Auth=<set>"

# ── Core curl wrapper ────────────────────────────────────────
_ado_curl() {
  # Usage: _ado_curl <url> [extra curl args...]
  local url="$1"; shift
  curl -s --ssl-no-revoke -4 \
    -H "Authorization: Basic $ADO_AUTH" \
    -H "Content-Type: application/json" \
    "$@" "$url"
}

# ── Work item fetch ──────────────────────────────────────────
ado_get_item() {
  local id="$1"
  local expand="${2:-all}"   # all | relations | fields | links
  local url="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${id}?\$expand=${expand}&api-version=7.1"

  local raw
  raw=$(_ado_curl "$url")

  if [[ -z "$raw" ]]; then
    echo "[ado_get_item] ERROR: empty response for item $id" >&2
    return 1
  fi

  # Pretty-print with node (always available in your env)
  echo "$raw" | node -e "
const chunks=[]; process.stdin.on('data',c=>chunks.push(c)); process.stdin.on('end',()=>{
  let d;
  try { d=JSON.parse(Buffer.concat(chunks)); } catch(e){ process.stdout.write(Buffer.concat(chunks)); return; }
  const f=d.fields||{};
  const strip=s=>(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&quot;/g,'\"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  console.log('ID     :', d.id);
  console.log('Title  :', f['System.Title']||'');
  console.log('Type   :', f['System.WorkItemType']||'');
  console.log('State  :', f['System.State']||'');
  console.log('Sprint :', f['System.IterationPath']||'');
  console.log('Assign :', (f['System.AssignedTo']||{}).displayName||'');
  console.log('');
  console.log('── Description ─────────────────────────────────');
  console.log(strip(f['System.Description'])||'(none)');
  console.log('');
  console.log('── Acceptance Criteria ──────────────────────────');
  console.log(strip(f['Microsoft.VSTS.Common.AcceptanceCriteria'])||'(none)');
  if(d.relations && d.relations.length){
    console.log('');
    console.log('── Relations ────────────────────────────────────');
    d.relations.forEach(r=>console.log(' ',r.rel, r.url));
  }
});
"
}

# ── Raw JSON dump (for piping to jq, etc.) ──────────────────
ado_raw() {
  local id="$1"
  local expand="${2:-all}"
  local url="https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${id}?\$expand=${expand}&api-version=7.1"
  _ado_curl "$url"
}

echo "[ado.sh] Functions available: ado_get_item <id>  |  ado_raw <id> [expand]"
