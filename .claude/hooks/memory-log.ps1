#!/usr/bin/env pwsh
# hooks/memory-log.ps1 — PostToolUse hook: log MEMORY.md writes to dream-log.md (PowerShell port of memory-log.sh)
#
# Fallback when bash is unavailable. Behaviour is identical to memory-log.sh.
# Invoked by dispatch.ps1 — do not call directly from settings.json.
#
# Guard: only active when .claude/dream-init-state.json exists (plugin-provisioned project).
# Stdin: tool event JSON from Claude Code (passed through by dispatch.ps1 via process inheritance).

if (-not (Test-Path '.claude/dream-init-state.json')) { exit 0 }

# Node reads stdin directly — it inherits the Claude Code stdin stream via process inheritance.
# The JS is identical to memory-log.sh; no bash-specific constructs were used there.
$js = @'
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
    // - Edit:  parse from new_string (only the changed/appended content)
    // - Write: take the last ### header as approximation
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
'@

& node -e $js
exit $LASTEXITCODE