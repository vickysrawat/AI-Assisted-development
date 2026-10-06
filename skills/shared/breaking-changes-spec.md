# Breaking Changes Spec — Invocation Contract, Document Schema, Read Priority
_Spec version: 1.0 · Last changed: 2026-10-01 · Applies to: upgrade skill (Step 3)_

This is the canonical contract between `agents/breaking-changes-agent.md` and any calling
skill that needs version-pair breaking changes. It defines the two-tier read-priority logic,
document format, agent invocation pattern, and freshness rules.

---

## Section 1 — Two-Tier Document Pattern

Breaking-change facts for a version pair live in TWO locations. Check in this order — use
the first fresh document found; invoke the agent only if neither tier is fresh.

### Tier 1 — Project document (committed, team-visible)

```
{project_root}/.claude/migration-knowledge/breaking-changes/{source_stack}-{source_version}-to-{target_version}.md
```

Example: `.claude/migration-knowledge/breaking-changes/dotnet-8-to-10.md`

- Committed with the project repo → visible to all team members, reviewable, correctable.
- Source of truth for this project's upgrade run.
- Written by the calling skill immediately after the agent returns — before any analysis.

### Tier 2 — Plugin machine cache (machine-level, never committed)

```
{PLUGIN_DIR}/.plugin-cache/breaking-changes/{source_stack}-{source_version}-to-{target_version}.md
```

Example: `$PLUGIN_DIR/.plugin-cache/breaking-changes/dotnet-8-to-10.md`

- Machine-level — shared across all projects on this machine.
- When a second project upgrades the same stack version pair, the agent is skipped entirely.
- Never committed to any project repo or the plugin repo.
- Written by the calling skill in the same operation as Tier 1.

### Fallback — Offline mapping (air-gapped / no-web environments only)

```
{PLUGIN_DIR}/skills/shared/migration-knowledge/refs/mappings/{stack}-upgrade.md
```

- INFERRED confidence (lowest tier). Never overrides a Tier 1 or Tier 2 document.
- Consulted only when both tiers are absent AND the agent cannot reach the web.
- The calling skill logs a `[FINDING]` entry when falling back to this tier.

---

## Section 2 — Read Priority Implementation (calling skill)

```bash
STACK="{source_stack}"
FROM="{source_version}"
TO="{target_version}"
DOC_NAME="${STACK}-${FROM}-to-${TO}.md"
TIER1=".claude/migration-knowledge/breaking-changes/${DOC_NAME}"
TIER2="$PLUGIN_DIR/.plugin-cache/breaking-changes/${DOC_NAME}"
FRESHNESS_DAYS=90
BC_DOC=""

# Extract age in days from a document's embedded retrieved_date comment header.
# Documents contain: <!-- retrieved_date: YYYY-MM-DD -->
# Write to temp file — /dev/stdin is not available on Windows.
get_doc_age() {
  local doc_path="$1"
  local AGE_TMP="$(mktemp).age.txt"
  node -e "
    const fs=require('fs');
    try {
      const content=fs.readFileSync('${doc_path}','utf8');
      const m=content.match(/<!--\\s*retrieved_date:\\s*(\\d{4}-\\d{2}-\\d{2})\\s*-->/);
      if(m){
        const age=Math.floor((Date.now()-Date.parse(m[1]))/86400000);
        fs.writeFileSync('${AGE_TMP}',String(age));
      } else { fs.writeFileSync('${AGE_TMP}','999'); }
    } catch(e){ fs.writeFileSync('${AGE_TMP}','999'); }
  "
  cat "$AGE_TMP"
}

# Check Tier 1
if [ -f "$TIER1" ]; then
  AGE=$(get_doc_age "$TIER1")
  if [ "$AGE" -le "$FRESHNESS_DAYS" ]; then
    echo "Breaking changes Tier 1 hit (${AGE}d old) — skipping agent invocation"
    BC_DOC="$TIER1"
  else
    echo "Breaking changes Tier 1 stale (${AGE}d old)"
  fi
fi

# Check Tier 2 (only if Tier 1 missed or is stale)
if [ -z "$BC_DOC" ] && [ -f "$TIER2" ]; then
  AGE=$(get_doc_age "$TIER2")
  if [ "$AGE" -le "$FRESHNESS_DAYS" ]; then
    echo "Breaking changes Tier 2 hit (${AGE}d old) — copying to Tier 1, skipping agent"
    mkdir -p "$(dirname "$TIER1")"
    cp "$TIER2" "$TIER1"
    BC_DOC="$TIER1"
  else
    echo "Breaking changes Tier 2 stale (${AGE}d old)"
  fi
fi

# If both tiers missed: invoke the agent (Section 3)
if [ -z "$BC_DOC" ]; then
  echo "Breaking changes cache miss — invoking breaking-changes-agent"
  # → proceed to Section 3
fi
```

---

## Section 3 — Agent Invocation and Dual-Tier Write

When both tiers are absent or stale, invoke the `breaking-changes-agent`.

**Collect detected packages** — use the stack-appropriate command to list top-level dependencies.
Write to a temp file (Windows-safe — no pipe to /dev/stdin):

```bash
PKGS_TMP="$(mktemp).pkgs.txt"
PKGS_JSON_TMP="$(mktemp).pkgs.json"

# dotnet
dotnet list package 2>/dev/null | grep "^   >" | awk '{print $2}' > "$PKGS_TMP" 2>/dev/null || true
# angular / nodejs (adjust if using yarn or pnpm)
# node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};require('fs').writeFileSync('$PKGS_TMP',Object.keys(d).join('\n'))"

node -e "
  const fs=require('fs');
  try {
    const lines=fs.readFileSync('$PKGS_TMP','utf8').trim().split('\n').filter(Boolean);
    fs.writeFileSync('$PKGS_JSON_TMP',JSON.stringify(lines));
  } catch(e){ fs.writeFileSync('$PKGS_JSON_TMP','[]'); }
"
DETECTED_PACKAGES=$(node -e "process.stdout.write(require('fs').readFileSync('$PKGS_JSON_TMP','utf8'))")
```

**Invoke the Agent tool (exactly ONE call):**

```
Agent tool call — breaking-changes-agent:
  task: {
    "source_stack": "{stack}",
    "source_version": "{from_version}",
    "target_stack": "{stack}",
    "target_version": "{target_version}",
    "detected_packages": {DETECTED_PACKAGES},
    "plugin_dir": "$PLUGIN_DIR"
  }
  Receives back: JSON bundle per Section 4
```

Do NOT retry on UNKNOWN results — UNKNOWN is a correct terminal state for packages with no
public changelog. Do NOT invoke the agent multiple times.

**Write both tiers immediately after receiving the bundle — before any analysis:**

```bash
BUNDLE_TMP="$(mktemp).bundle.json"
# Write the returned bundle JSON to the temp file:
# echo '{...bundle JSON...}' > "$BUNDLE_TMP"

# Render the bundle to the document format (Section 5) and write both tiers:
mkdir -p "$(dirname "$TIER1")"
mkdir -p "$(dirname "$TIER2")"
node -e "
  const fs=require('fs');
  const bundle=JSON.parse(fs.readFileSync('$BUNDLE_TMP','utf8'));
  const date=bundle.retrieved_date;
  const lines=[];
  lines.push('# Breaking Changes — '+bundle.source_stack+' '+bundle.source_version+' → '+bundle.target_version);
  lines.push('<!-- retrieved_date: '+date+' -->');
  lines.push('_Retrieved: '+date+' · Source: breaking-changes-agent_');
  lines.push('');
  lines.push('## Framework Breaking Changes');
  const byS={HIGH:[],MEDIUM:[],LOW:[]};
  (bundle.framework_breaking_changes||[]).forEach(i=>{ (byS[i.severity]||[]).push(i); });
  ['HIGH','MEDIUM','LOW'].forEach(sev=>{
    if(byS[sev].length===0) return;
    lines.push('### '+sev+' severity');
    lines.push('| Area | Introduced | Description | Workaround | Source |');
    lines.push('|---|---|---|---|---|');
    byS[sev].forEach(i=>{
      const src=i.source_url?'[link]('+i.source_url+')':'[check]('+i.canonical_url+')';
      lines.push('| '+i.area+' | '+i.introduced_in+' | '+i.description+' | '+i.workaround+' | '+src+' |');
    });
    lines.push('');
  });
  lines.push('## Package Breaking Changes');
  (bundle.package_breaking_changes||[]).forEach(pkg=>{
    lines.push('### '+pkg.package);
    lines.push('**Status:** '+pkg.status+(pkg.checked_url?' · [changelog]('+pkg.checked_url+')':''));
    if(pkg.status==='breaking_changes_found'&&pkg.items.length>0){
      lines.push('| Severity | Description | Workaround | Source |');
      lines.push('|---|---|---|---|');
      pkg.items.forEach(i=>{
        const src=i.source_url?'[link]('+i.source_url+')':'–';
        lines.push('| '+i.severity+' | '+i.description+' | '+i.workaround+' | '+src+' |');
      });
    } else if(pkg.status==='UNKNOWN'){
      lines.push('_Could not retrieve changelog — check manually: '+pkg.canonical_url+'_');
    }
    lines.push('');
  });
  const doc=lines.join('\n');
  fs.writeFileSync('$TIER1',doc);
  fs.writeFileSync('$TIER2',doc);
"
BC_DOC="$TIER1"
echo "Breaking changes written to Tier 1 and Tier 2."
```

---

## Section 4 — Bundle Schema

See `agents/breaking-changes-agent.md` Step 4 for the full JSON schema.

---

## Section 5 — Freshness Rules

| Scenario | TTL | Action |
|---|---|---|
| Target is a stable released version | 90 days | Breaking changes are immutable once shipped — refresh at TTL only |
| Target is preview/RC | 14 days | Facts may change before GA |
| Document has no `retrieved_date` comment | Treat as stale (age=999) | Re-invoke agent |
| Agent returned UNKNOWN for a package | Re-check at 30 days | Package may publish changelog later |
| Offline fallback used (no agent) | Do not write to Tier 1/2 | Log `[FINDING]`: offline tier used — quality is INFERRED |

---

## Section 6 — How Calling Skills Use the Document

After `BC_DOC` is set (Tier 1 path), read the document as the **starting checklist**
for the gap/risk analysis:

```bash
Read $BC_DOC
```

Every HIGH severity item in the document is a candidate RED finding in the gap/risk report.
Every MEDIUM item is a candidate YELLOW finding. Every UNKNOWN package item is surfaced with
a `⚠ Package changelog not verified` warning inline in the report.

The document does NOT replace the web-grounded analysis for the specific project (which may
have additional packages or custom code touching the changed APIs). It is the mandatory
baseline that ensures known breaking changes are never silently missed.
