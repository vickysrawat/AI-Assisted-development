#!/usr/bin/env bash
# hooks/memory-log.sh — PostToolUse hook: log MEMORY.md writes to dream-log.md
#
# Fires after every Write/Edit tool call. Detects writes to memory/MEMORY.md and
# appends lightweight [capture] entries to memory/dream-log.md so the audit trail
# is populated from the first auto-capture, not only after /dream runs.
#
# Header extraction:
#   Edit  — reads new_string (only the changed/appended content) so all new headers
#           in one Edit call are captured.
#   Write — takes the last ### header in the full file as an approximation (a single
#           Write call adding multiple entries is a known limitation; the last entry
#           is logged; earlier ones are not — see docs/adr/).
#
# Windows safety:
#   - Normalises \r\n → \n before JSON.parse and before line splitting MEMORY.md.
#   - Normalises backslash paths before endsWith check.
#   - Does NOT use < /dev/stdin; node inherits stdin from the parent bash process.
#
# Wired as hooks.PostToolUse in .claude/settings.json by setup-init bootstrap.
# See docs/adr/0053-memory-log-hook.md for design rationale.

[ -f ".claude/dream-init-state.json" ] || exit 0

node -e '
const fs = require("fs");
let raw = "";
process.stdin.on("data", d => raw += d);
process.stdin.on("end", () => {
  try {
    const ev   = JSON.parse(raw.replace(/\r\n/g, "\n"));
    const tool = ev.tool_name || "";
    const fp   = ((ev.tool_input || {}).file_path || (ev.tool_input || {}).path || "")
                   .replace(/\\/g, "/");

    if ((tool !== "Write" && tool !== "Edit") || !fp.endsWith("memory/MEMORY.md")) {
      process.exit(0);
    }
    if (!fs.existsSync("memory/MEMORY.md")) process.exit(0);

    // Extract new headers:
    // - Edit: parse from new_string (contains only the changed/appended content)
    // - Write: take the last header as approximation
    let headers = [];
    if (tool === "Edit") {
      const newStr = (ev.tool_input.new_string || "").replace(/\r\n/g, "\n");
      headers = newStr.split("\n").filter(l => l.startsWith("### "));
    } else {
      const content = fs.readFileSync("memory/MEMORY.md", "utf8").replace(/\r\n/g, "\n");
      const last = content.split("\n").filter(l => l.startsWith("### ")).slice(-1)[0];
      if (last) headers = [last];
    }

    if (!headers.length) process.exit(0);

    // Prepend separator only when dream-log.md already has content
    const logPath   = "memory/dream-log.md";
    const logExists = fs.existsSync(logPath) &&
                      fs.readFileSync(logPath, "utf8").trim().length > 0;
    const sep     = logExists ? "\n" : "";
    const entries = sep + headers
      .map(h => h.replace(/^### /, "### [capture] "))
      .join("\n") + "\n";

    fs.appendFileSync(logPath, entries);
  } catch (e) {
    process.exit(0);  // never block Claude on hook error
  }
});
'
