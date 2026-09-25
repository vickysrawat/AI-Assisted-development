#!/usr/bin/env python3
"""hooks/validate-pr-compliance.py — server-side authoritative PR gates (ADR 0009).

Runs in the CI pipeline as a required Build Validation on the target branch
policy. Local hooks are bypassable (`git commit --no-verify`, deleted hooks);
this script runs where no developer can reach. Two deterministic checks:

  1. ICEA floor, per-PR: the branch must contain an ICEA file with
     `Status: Approved` (or `Tier: T1` with a recorded classification rationale)
     whose ADO ID matches the source branch name pattern. Coarse but unbypassable.

  2. T1 bound re-verification as pure diff math: if the matched ICEA says
     Tier: T1, the diff against the target branch must satisfy T1 bounds
     (<=1 source file, <=20 changed lines). A grown T1 fails the pipeline
     even when the local checkin was skipped entirely.

Bypass telemetry for free: a failure here when local gates "passed" means a
local bypass occurred — the CI failure itself becomes a gate-override datapoint
for the net-value scorecard (sprint-metrics greps pipeline history).

Usage:
  python3 hooks/validate-pr-compliance.py --source-branch <name> --target <ref>
  (in ADO: --source-branch "$(Build.SourceBranchName)" --target "origin/$(System.PullRequest.TargetBranchName)")
Exit 0 = pass, 1 = fail (fails the required check, blocks the merge).
"""
import argparse, glob, os, re, subprocess, sys

SOURCE_EXT = (".cs", ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".sql", ".html", ".css", ".scss")

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

def fail(msg):
    print(f"❌ pr-compliance: {msg}")
    sys.exit(1)

p = argparse.ArgumentParser()
p.add_argument("--source-branch", required=True)
p.add_argument("--target", required=True)
args = p.parse_args()

# ── Check 0: does this PR even touch source? Docs-only PRs are exempt ─────────
diff_files = sh(f"git diff --name-only {args.target}...HEAD").splitlines()
src_files = [f for f in diff_files if f.endswith(SOURCE_EXT) and not f.startswith(("tests/", "docs/"))]
if not src_files:
    print("✅ pr-compliance: docs/tests-only PR — ICEA floor not applicable.")
    sys.exit(0)

# ── Check 1: ICEA floor ────────────────────────────────────────────────────────
# Branch pattern: feature/ADO-1847-..., bugfix/ADO-1847-..., etc.
m = re.search(r"ADO-?(\d+)", args.source_branch, re.I)
ado_id = m.group(1) if m else None

candidates = glob.glob("docs/**/ADO-*.md", recursive=True) + glob.glob("docs/**/icea-*.md", recursive=True)
matched = None
for c in candidates:
    content = open(c).read()
    approved = re.search(r"Status:.*Approved", content)
    t1 = re.search(r"Tier:\s*T1\s*\(auto-classified", content)
    if not (approved or t1):
        continue
    if ado_id and f"ADO-{ado_id}" not in content and f"#{ado_id}" not in content:
        continue
    matched = (c, bool(t1) and not approved)
    break

if not matched:
    detail = f"matching ADO-{ado_id}" if ado_id else "(no ADO ID in branch name — any approved ICEA accepted, none found)"
    fail(f"no approved ICEA (or T1 auto-ICEA) found on this branch {detail}. "
         f"Source files changed: {len(src_files)}. The ICEA gate is server-side "
         f"authoritative — create and approve an ICEA, commit it, and re-run.")

icea_path, is_t1 = matched
print(f"   ICEA found: {icea_path} ({'T1 auto' if is_t1 else 'Approved'})")

# ── Check 2: T1 bound re-verification (pure diff math) ────────────────────────
if is_t1:
    stat = sh(f"git diff --numstat {args.target}...HEAD -- " + " ".join(f'"{f}"' for f in src_files))
    total_lines = 0
    for line in stat.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
            total_lines += int(parts[0]) + int(parts[1])
    if len(src_files) > 1 or total_lines > 20:
        fail(f"ICEA is Tier T1 but the diff exceeds T1 bounds: {len(src_files)} source "
             f"file(s), {total_lines} changed lines (limits: 1 file, 20 lines). "
             f"The change outgrew its tier — produce a full ICEA (T2/T3) and re-run. "
             f"Tier re-classification only moves up. (If local /checkin passed, a "
             f"local bypass occurred; this event counts as a gate override in sprint metrics.)")
    print(f"   T1 bounds verified: {len(src_files)} file, {total_lines} lines")

print("✅ pr-compliance: ICEA floor satisfied.")
sys.exit(0)
