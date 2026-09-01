#!/usr/bin/env python3
"""hooks/validate-audit.py — CI-side governance audit-log validation.

The governance audit trail (.claude/audit/<date>-<pid>.jsonl shards) is only trustworthy if
existing entries are never rewritten. This enforces that deterministically in CI; a non-zero
exit fails the pipeline. Like the other validators it is ADVISORY until wired into the
pipeline and the branch is protected — the plugin ships an instruction, not a running pipeline.

Invariants enforced:
  1. Every line is valid JSON carrying the required fields (ts, event, actor_confidence)
  2. `event` is one of the known taxonomy values
  3. `ts` is an ISO-8601 UTC timestamp
  4. Append-only: for every shard that also exists on the base ref, the base's lines are an
     exact prefix of the current lines (no existing line modified or removed)

Caveat: the append-only check compares line-for-line against the base ref and assumes a
non-squash merge. Under a squash-merge workflow run schema-only — pass --no-base (or leave
the base ref unresolvable).

Usage:
  python3 hooks/validate-audit.py [repo-root] [--base <ref>] [--no-base]
"""
import glob, json, os, re, subprocess, sys

AUDIT_GLOB = os.path.join(".claude", "audit", "*.jsonl")
REQUIRED = ("ts", "event", "actor_confidence")
ALLOWED_EVENTS = {
    "gate.block", "gate.bypass", "gate.approve", "gate.mismatch",
    "pr.linked", "finding.dismiss",
}
TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

errors = []

def parse_args(argv):
    root, base, no_base = ".", None, False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--base":
            i += 1
            base = argv[i] if i < len(argv) else None
        elif a == "--no-base":
            no_base = True
        elif not a.startswith("--"):
            root = a
        i += 1
    return root, base, no_base

def git_lines(ref, path):
    try:
        out = subprocess.run(["git", "show", f"{ref}:{path}"],
                             capture_output=True, text=True, check=True).stdout
        return [ln for ln in out.split("\n") if ln.strip() != ""]
    except Exception:
        return None  # not present on base (new shard) or not a git repo

def resolve_base(explicit):
    if explicit:
        return explicit
    for ref in ("origin/main", "main", "origin/master", "master"):
        try:
            subprocess.run(["git", "rev-parse", "--verify", ref],
                           capture_output=True, check=True)
            return ref
        except Exception:
            continue
    return None

def main():
    root, base_arg, no_base = parse_args(sys.argv[1:])
    os.chdir(root)

    shards = sorted(glob.glob(AUDIT_GLOB))
    base = None if no_base else resolve_base(base_arg)

    for shard in shards:
        with open(shard, encoding="utf-8") as fh:
            cur = [ln for ln in fh.read().split("\n") if ln.strip() != ""]

        # 1–3 schema
        for n, line in enumerate(cur, 1):
            try:
                rec = json.loads(line)
            except Exception:
                errors.append(f"{shard}:{n}: not valid JSON")
                continue
            for k in REQUIRED:
                if k not in rec or rec[k] in (None, ""):
                    errors.append(f"{shard}:{n}: missing required field '{k}'")
            ev = rec.get("event")
            if ev is not None and ev not in ALLOWED_EVENTS:
                errors.append(f"{shard}:{n}: unknown event '{ev}'")
            if not TS_RE.match(str(rec.get("ts", ""))):
                errors.append(f"{shard}:{n}: ts is not ISO-8601 UTC ('{rec.get('ts', '')}')")

        # 4 append-only vs base
        if base:
            base_lines = git_lines(base, shard.replace(os.sep, "/"))
            if base_lines is not None:
                if len(cur) < len(base_lines) or cur[:len(base_lines)] != base_lines:
                    errors.append(f"{shard}: append-only violation — an existing audit line "
                                  f"was modified or removed relative to {base}")

    if errors:
        print(f"❌ Audit-log validation failed — {len(errors)} error(s):")
        for e in errors:
            print(f"   ✗ {e}")
        sys.exit(1)

    scope = f"(append-only vs {base})" if base else "(schema-only; no base ref)"
    print(f"✅ Audit-log validation passed {scope} — {len(shards)} shard(s).")

if __name__ == "__main__":
    main()
