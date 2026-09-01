#!/usr/bin/env node
// hooks/findings-gate-precommit.cjs — git pre-commit hook (pure Node.js)
//
// Installed as .git/hooks/pre-commit by setup-init-bootstrap.cjs when shell_type != "bash".
// Git for Windows resolves #!/usr/bin/env node via PATH — no bash required.
// Identical enforcement to findings-gate-precommit.sh.

'use strict';
const fs              = require('fs');
const path            = require('path');
const { spawnSync }   = require('child_process');

// Best-effort governance-audit append — never blocks the commit.
function audit(evt) { try { require('./audit-append.cjs').appendEvent(evt); } catch (e) { /* best-effort */ } }

if (process.env.SKIP_FINDINGS_GATE === '1') {
  // A bypass must carry a justification — the error message IS the ask (a pre-commit hook
  // cannot prompt-and-wait interactively).
  const justification = (process.env.FINDINGS_GATE_JUSTIFICATION || '').trim();
  if (!justification) {
    process.stderr.write(
      '\n❌ SKIP_FINDINGS_GATE=1 requires a justification.\n' +
      '   Set FINDINGS_GATE_JUSTIFICATION="reason" to bypass, e.g.:\n' +
      '   SKIP_FINDINGS_GATE=1 FINDINGS_GATE_JUSTIFICATION="hotfix CVE waiver ADO-1234" git commit ...\n\n');
    process.exit(1);
  }
  audit({ event: 'gate.bypass', action: 'SKIP_FINDINGS_GATE', result: 'granted', source: 'pre-commit', detail: justification });
  console.log('⚠ SKIP_FINDINGS_GATE=1 — findings gate bypassed (justification logged to the audit trail)');
  process.exit(0);
}

// Run secrets check on staged settings.json (always Node.js)
const secretsHook = path.join('.claude', 'hooks', 'check-settings-secrets.cjs');
if (fs.existsSync(secretsHook)) {
  const r = spawnSync(process.execPath, [secretsHook, '--staged'], { stdio: 'inherit' });
  if (r.status !== 0) {
    audit({ event: 'gate.block', action: 'secrets-guard', result: 'blocked', source: 'pre-commit' });
    process.exit(r.status || 1);
  }
}

// Parse ledger files for open Critical/High findings
const LEDGERS = [
  'CodeReviews/code-review-ledger.md',
  'security/security-ledger.md',
  'dynamic-scan/dynamic-scan-ledger.md',
];

let total = 0;
const openFindings = [];

for (const ledger of LEDGERS) {
  if (!fs.existsSync(ledger)) continue;
  const content = fs.readFileSync(ledger, 'utf8');
  // Extract only the "## Open Findings" section — stop at next ## heading.
  // Mirrors the awk '/^## Open Findings/{flag=1;next}/^## /{flag=0}flag' in the .sh version.
  const parts = content.split(/^(?=##\s)/m);
  const openPart = parts.find(p => /^##\s+Open Findings/m.test(p)) || '';
  // Pattern anchored at end of line — severity must be the last word (matches .sh grep -E pattern)
  const matches = openPart.match(/^###\s+\[FP-[a-f0-9]+[a-z]?\]\s+.*\b(Critical|High)$/gm) || [];
  total += matches.length;
  matches.forEach(m => openFindings.push({ ledger, title: m.replace(/^###\s+/, '') }));
}

if (total > 0) {
  audit({ event: 'gate.block', action: 'findings-gate', result: 'blocked', source: 'pre-commit', detail: total + ' open Critical/High' });
  process.stderr.write('\n❌ COMMIT BLOCKED: ' + total + ' open Critical/High finding(s) must be resolved before committing.\n');
  openFindings.forEach(f => process.stderr.write('  ' + f.ledger + ': ' + f.title + '\n'));
  process.stderr.write('\nResolve findings or set SKIP_FINDINGS_GATE=1 (with FINDINGS_GATE_JUSTIFICATION="reason") to bypass.\n\n');
  process.exit(1);
}
process.exit(0);
