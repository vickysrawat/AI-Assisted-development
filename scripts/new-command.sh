#!/usr/bin/env bash
# scripts/new-command.sh <command-name>
# Scaffolds a new command with all required boilerplate, registers it in plugin.json,
# creates a command stub, and adds a test scenario placeholder.
# Run from the plugin root directory.

set -e

CMD="$1"
if [ -z "$CMD" ]; then
  echo "Usage: ./scripts/new-command.sh <command-name>"
  echo "Example: ./scripts/new-command.sh my-new-command"
  exit 1
fi

if [ -f "commands/$CMD.md" ]; then
  echo "❌  commands/$CMD.md already exists. Choose a different name or edit manually."
  exit 1
fi

echo "🔧  Scaffolding command: $CMD"

# 1. Create commands/<name>.md
cat > "commands/$CMD.md" << CMDEOF
---
description: TODO: One-line summary shown in VS Code command picker.
argument-hint: TODO: argument format, e.g. "<FP-xxxxxxxx>" or "(no arguments)"
---

## Model routing

This command uses the **infrastructure tier** — \`INFRA_MODEL\`
(default: \`claude-sonnet-4-6\`).

To override: \`{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }\` in \`.claude/settings.json\`.
See \`skills/shared/model-routing-spec.md\` for the full specification.

---

# /$CMD — TODO: Human-readable title

TODO: One paragraph describing what this command does, when to run it,
and what it does NOT do.

---

## Step 1 — Parse arguments

TODO: Describe argument parsing and validation.

---

## Step 2 — TODO

TODO: Add remaining steps.

---

## Hard rules

- TODO: Add hard rules
- NEVER proceed without explicit developer confirmation for destructive operations
CMDEOF

echo "  ✓ Created commands/$CMD.md"

# 2. Create command stub
cat > "_project-deploy/commands/$CMD.md" << STUBEOF
---
description: TODO: One-line description shown in VS Code command picker.
---
<command>$CMD</command>
STUBEOF

echo "  ✓ Created _project-deploy/commands/$CMD.md"

# 3. Create test scenario placeholder
cat > "tests/skill-scenarios/$CMD.yaml" << YAMLEOF
skill: $CMD
scenarios:
  - id: basic-invocation
    description: "TODO: Should execute primary function correctly"
    input: "/$CMD TODO: add arguments"
    expect:
      triggered: true
      contains: ["TODO: expected output string"]
      not_contains: ["TODO: string that must NOT appear"]

  - id: hard-rule-enforcement
    description: "TODO: Must enforce primary hard rule"
    input: "TODO: input that tests the hard rule"
    expect:
      triggered: true
      contains: ["TODO: expected gate/stop string"]
YAMLEOF

echo "  ✓ Created tests/skill-scenarios/$CMD.yaml"

# 4. Register in plugin.json
python3 - << PYEOF
import json
with open('.claude-plugin/plugin.json') as f:
    p = json.load(f)
if '$CMD' not in p['components']['commands']:
    p['components']['commands'].append('$CMD')
    p['components']['commands'].sort()
with open('.claude-plugin/plugin.json', 'w') as f:
    json.dump(p, f, indent=2)
print("  ✓ Registered in plugin.json components.commands")
PYEOF

# 5. Remind about setup-init stub deployment
echo ""
echo "📋  Manual steps still required:"
echo "    1. Fill in all TODO fields in commands/$CMD.md"
echo "    2. Add '$CMD.md' to the stub deployment loop in commands/setup-init.md"
echo "    3. Add '$CMD.md' to the check 1d loop in skills/setup-status/SKILL.md"
echo "    4. Add a row to the commands table in README.md"
echo "    5. Run: python3 tests/validate.py"
echo ""
echo "✅  Scaffold complete. Run 'python3 tests/validate.py' to check for remaining gaps."
