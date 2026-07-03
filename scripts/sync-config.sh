#!/bin/bash
# sync-config.sh — propagate .claude-plugin/config.json (the single source of truth
# for organization / project / company / repo identity) into the machine-readable
# manifests that must carry literal values:
#   • .claude-plugin/plugin.json      → author.name, repository (derived clone URL)
#   • .claude-plugin/marketplace.json → description ("{company} internal Claude Code plugins")
#
# Run after editing config.json (e.g. to rebrand or point at another Azure DevOps org).
# Idempotent. Requires node. See DEVELOPER-GUIDE.md > Rebranding / forking.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node -e '
const fs = require("fs");
const cfgPath = ".claude-plugin/config.json";
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const need = ["company","organization","project","adoBaseUrl","pluginRepoName"];
for (const k of need) if (!cfg[k]) { console.error(`config.json missing "${k}"`); process.exit(1); }

const cloneUrl = `${cfg.adoBaseUrl}/${cfg.organization}/${cfg.project}/_git/${cfg.pluginRepoName}`;
const mktDesc  = `${cfg.company} internal Claude Code plugins`;
// marketplaceName is derived from the organization: "<org>-marketplace" for a real
// org, else "local-marketplace". Written back to config.json so it stays in sync.
const realOrg  = cfg.organization && cfg.organization !== "your-org";
const mktName  = realOrg ? `${cfg.organization}-marketplace` : "local-marketplace";
if (cfg.marketplaceName !== mktName) {
  cfg.marketplaceName = mktName;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`✓ config.json      marketplaceName="${mktName}" (derived from organization)`);
}

// plugin.json — author.name, author.url (from companyUrl), repository
const pjPath = ".claude-plugin/plugin.json";
const pj = JSON.parse(fs.readFileSync(pjPath, "utf8"));
pj.author = pj.author || {};
pj.author.name = cfg.company;
if (cfg.companyUrl) pj.author.url = cfg.companyUrl; else delete pj.author.url;
pj.repository = cloneUrl;
fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + "\n");
console.log(`✓ plugin.json      author.name="${cfg.company}"  author.url=${cfg.companyUrl||"(none)"}  repository=${cloneUrl}`);

// marketplace.json — name (from marketplaceName) + description
const mkPath = ".claude-plugin/marketplace.json";
if (fs.existsSync(mkPath)) {
  const mk = JSON.parse(fs.readFileSync(mkPath, "utf8"));
  if (cfg.marketplaceName) mk.name = cfg.marketplaceName;
  mk.description = mktDesc;
  fs.writeFileSync(mkPath, JSON.stringify(mk, null, 2) + "\n");
  console.log(`✓ marketplace.json name="${mk.name}"  description="${mktDesc}"`);
}

console.log("Config synced. (Runtime skills read org/project from CLAUDE.md §2, seeded by dream-init.)");
'
