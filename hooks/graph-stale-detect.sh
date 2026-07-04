#!/usr/bin/env bash
# graph-stale-detect.sh — knowledge-graph staleness detector (git post-merge / post-checkout hook)
#
# Pure shell + one node JSON read. No LLM. Completes in < 1 second on typical repos.
# Recomputes each module's *module-wide* fingerprint (all files under the module's
# paths, not a single entry-point file — see skills/shared/graph-json-schema.md) and
# compares it to the stored fingerprint in .claude/graph/graph.json. On any mismatch
# (or a new/removed source root) it writes .claude/graph/.stale listing the drifted
# modules, so the developer knows to run /graph-sync. Never regenerates the graph
# itself — detection only.
#
# Exit code is always 0: a hook must never block a merge/checkout.

set -u

GRAPH_DIR=".claude/graph"
GRAPH_JSON="$GRAPH_DIR/graph.json"
STALE_FLAG="$GRAPH_DIR/.stale"

# Nothing to check if the graph was never generated (run /dream-init first).
[ -f "$GRAPH_JSON" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0
command -v sha1sum >/dev/null 2>&1 || exit 0

# Module-wide fingerprint: hash filenames + contents of every source file under the
# given path roots, minus the intra-module noise floor. Deterministic via sort -z.
graph_module_fingerprint() {
  { for root in "$@"; do
      [ -e "$root" ] || continue
      find "$root" -type f \
        -not -path '*/.git/*'   -not -path '*/node_modules/*' \
        -not -path '*/bin/*'    -not -path '*/obj/*' \
        -not -path '*/dist/*'   -not -path '*/.angular/*' \
        -not -path '*/migrations/*' -not -path '*/__pycache__/*' \
        -print0 2>/dev/null
    done; } \
  | sort -z \
  | xargs -0 sha1sum 2>/dev/null \
  | sha1sum | cut -d' ' -f1
}

# Emit one line per node: "<id>\t<stored-fingerprint>\t<glob1> <glob2> ...".
# Globs are the node paths with a trailing /** stripped to a real directory root.
NODES="$(node -e '
  const fs = require("fs");
  try {
    const g = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const n of (g.nodes || [])) {
      const roots = (n.paths || []).map(p => p.replace(/\/\*\*.*$/, "").replace(/\/\*$/, ""));
      process.stdout.write(`${n.id}\t${n.fingerprint || ""}\t${roots.join(" ")}\n`);
    }
  } catch (e) { process.exit(0); }
' "$GRAPH_JSON" 2>/dev/null)"

[ -n "$NODES" ] || exit 0

STALE_MODULES=""
while IFS=$'\t' read -r id stored roots; do
  [ -n "$id" ] || continue
  # shellcheck disable=SC2086
  current="$(graph_module_fingerprint $roots)"
  if [ "$current" != "$stored" ]; then
    STALE_MODULES="${STALE_MODULES}${id} "
  fi
done <<< "$NODES"

if [ -n "$STALE_MODULES" ]; then
  {
    echo "# Knowledge graph is stale — run /graph-sync"
    echo "# Detected: $(date +%Y-%m-%dT%H:%M:%S 2>/dev/null)"
    echo "modules: ${STALE_MODULES% }"
  } > "$STALE_FLAG"
fi

exit 0
