#!/usr/bin/env node
// scripts/sync-config.cjs — propagate .claude-plugin/config.json → plugin.json / marketplace.json
//
// Standalone Node.js equivalent of sync-config.sh — no bash required.
// Usage: node scripts/sync-config.cjs
//
// Run after editing .claude-plugin/config.json to push company/org/project identity
// into plugin.json (author fields) and marketplace.json (name/description).

'use strict';
const fs   = require('fs');
const path = require('path');

const root    = path.join(__dirname, '..');
const cfgPath = path.join(root, '.claude-plugin', 'config.json');

if (!fs.existsSync(cfgPath)) {
  console.error('config.json not found at: ' + cfgPath);
  process.exit(1);
}

const cfg  = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const need = ['company', 'organization', 'project', 'adoBaseUrl', 'pluginRepoName'];
const missing = need.filter(k => !cfg[k]);
if (missing.length) {
  console.error('config.json is missing required fields: ' + missing.join(', '));
  process.exit(1);
}

// Update plugin.json author fields
const pluginJsonPath = path.join(root, '.claude-plugin', 'plugin.json');
if (fs.existsSync(pluginJsonPath)) {
  const pj = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  pj.author = pj.author || {};
  pj.author.name       = cfg.company;
  pj.author.repository = `https://${cfg.organization}@dev.azure.com/${cfg.organization}/${cfg.project}/_git/${cfg.pluginRepoName}`;
  fs.writeFileSync(pluginJsonPath, JSON.stringify(pj, null, 2) + '\n');
  console.log('✓ plugin.json updated (author.name, author.repository)');
}

// Update marketplace.json name + description
const mktDir  = path.join(root, '.claude-plugin');
const mktPath = path.join(mktDir, 'marketplace.json');
if (fs.existsSync(mktPath)) {
  const mkt  = JSON.parse(fs.readFileSync(mktPath, 'utf8'));
  const slug = cfg.organization.toLowerCase().replace(/[^a-z0-9]/g, '-');
  mkt.name        = `${slug}-marketplace`;
  mkt.description = `${cfg.company} internal Claude plugin marketplace`;
  fs.writeFileSync(mktPath, JSON.stringify(mkt, null, 2) + '\n');
  console.log('✓ marketplace.json updated (name, description)');
}

// Propagate marketplaceName into config.json if not set
if (!cfg.marketplaceName) {
  const slug = cfg.organization.toLowerCase().replace(/[^a-z0-9]/g, '-');
  cfg.marketplaceName = `${slug}-marketplace`;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('✓ config.json updated (marketplaceName)');
}

console.log('sync-config complete.');
