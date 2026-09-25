#!/usr/bin/env python3
"""hooks/validate-ledgers.py — CI-side ledger format validation.

Deterministic enforcement of ledger invariants that the model-instruction layer
can only encourage. Run in CI on every PR; non-zero exit fails the pipeline.

Invariants enforced:
  1. Every Dismissed finding has a non-empty Justification
  2. Every Dismissed finding has a valid Reason category
  3. No duplicate FP fingerprints within a ledger (collision rule)
  4. Dismissed entries carry Dismissed-by and Dismissed-date
  5. Summary line counts match the actual entries in each section

Usage: python3 hooks/validate-ledgers.py [repo-root]
"""
import os, re, sys

LEDGERS = [
    "CodeReviews/code-review-ledger.md",
    "security/security-ledger.md",
    "dynamic-scan/dynamic-scan-ledger.md",
]
VALID_REASONS = {"false-positive", "wont-fix", "accepted-risk", "by-design"}

errors = []

def section(content, name):
    m = re.search(rf"^## {name}\n(.*?)(?=^## |\Z)", content, re.M | re.S)
    return m.group(1) if m else ""

def entries(text):
    return re.findall(r"^### \[(FP-[a-f0-9]+[a-z]?)\] (.+)$", text, re.M)

root = sys.argv[1] if len(sys.argv) > 1 else "."
os.chdir(root)

for ledger in LEDGERS:
    if not os.path.exists(ledger):
        continue
    content = open(ledger).read()

    # 3 — no duplicate fingerprints across the whole ledger
    all_fps = re.findall(r"^### \[(FP-[a-f0-9]+[a-z]?)\]", content, re.M)
    seen = set()
    for fp in all_fps:
        if fp in seen:
            errors.append(f"{ledger}: duplicate fingerprint {fp} — collision rule violated")
        seen.add(fp)

    # 1, 2, 4 — dismissed entry integrity
    dismissed = section(content, "Dismissed Findings")
    for block in re.split(r"(?=^### \[FP-)", dismissed, flags=re.M):
        m = re.match(r"^### \[(FP-[a-f0-9]+[a-z]?)\]", block)
        if not m:
            continue
        fp = m.group(1)
        jm = re.search(r"\*\*Justification\*\*:[ \t]*(.*)", block)
        if not jm or not jm.group(1).strip() or jm.group(1).strip() in ("<free-text — the auditable why>",):
            errors.append(f"{ledger}: {fp} dismissed with empty justification")
        rm = re.search(r"\*\*Reason\*\*:\s*(\S+)", block)
        if not rm or rm.group(1) not in VALID_REASONS:
            errors.append(f"{ledger}: {fp} has invalid/missing dismissal Reason "
                          f"(must be one of {sorted(VALID_REASONS)})")
        if not re.search(r"\*\*Dismissed by\*\*:\s*\S", block):
            errors.append(f"{ledger}: {fp} missing Dismissed-by")
        if not re.search(r"\*\*Dismissed date\*\*:\s*\d{4}-\d{2}-\d{2}", block):
            errors.append(f"{ledger}: {fp} missing/invalid Dismissed-date")

    # 5 — summary counts match
    sm = re.search(r"Open:\s*(\d+)\s*·\s*Fixed:\s*(\d+)\s*·\s*Dismissed:\s*(\d+)", content)
    if sm:
        actual = (len(entries(section(content, "Open Findings"))),
                  len(entries(section(content, "Fixed Findings"))),
                  len(entries(section(content, "Dismissed Findings"))))
        declared = tuple(int(x) for x in sm.groups())
        if actual != declared:
            errors.append(f"{ledger}: summary says Open/Fixed/Dismissed={declared} "
                          f"but sections contain {actual}")

if errors:
    print(f"❌ Ledger validation failed — {len(errors)} error(s):")
    for e in errors:
        print(f"   ✗ {e}")
    sys.exit(1)

print("✅ Ledger validation passed.")
