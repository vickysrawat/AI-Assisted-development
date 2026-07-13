#!/usr/bin/env bash
# scripts/new-skill.sh <skill-name>
# Scaffolds a new skill with all required boilerplate, registers it in plugin.json,
# creates a command stub, adds a test scenario placeholder, and adds a README row.
# Run from the plugin root directory.

set -e

SKILL="$1"
if [ -z "$SKILL" ]; then
  echo "Usage: ./scripts/new-skill.sh <skill-name>"
  echo "Example: ./scripts/new-skill.sh my-new-skill"
  exit 1
fi

if [ -d "skills/$SKILL" ]; then
  echo "❌  skills/$SKILL/ already exists. Choose a different name or edit manually."
  exit 1
fi

echo "🔧  Scaffolding skill: $SKILL"

# 1. Create folder and SKILL.md
mkdir -p "skills/$SKILL/references"

cat > "skills/$SKILL/SKILL.md" << SKILLEOF
---
name: $SKILL
description: >
  TODO: One or two sentences describing what this skill does and when it triggers.
  Trigger on: "TODO: phrase one", "TODO: phrase two".
---
_Skill version: 1.0 · Last changed: $(date +%Y-%m-%d) · Consent: C_

## Model routing

This skill uses the **infrastructure tier** — \`INFRA_MODEL\`
(default: \`claude-sonnet-4-6\`).

To override: \`{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }\` in \`.claude/settings.json\`.
See \`../shared/model-routing-spec.md\` for the full specification.

---

## Purpose

TODO: Describe what this skill does and what it does NOT do.

---

## Step 1 — TODO

TODO: Add implementation steps.

---

## Reference files

| File | When to load |
|---|---|
| \`../shared/source-file-consent.md\` | Consent category — TODO: set A, B, or C and remove others |
| \`../shared/business-context-severity.md\` | TODO: load if this skill surfaces findings |
| \`../shared/model-routing-spec.md\` | Model routing tiers and env vars |

---

## Hard rules

- TODO: Add hard rules specific to this skill
- NEVER read source files without following the consent model in \`../shared/source-file-consent.md\`
SKILLEOF

echo "  ✓ Created skills/$SKILL/SKILL.md"

# 2. Create command stub
cat > "_project-deploy/commands/$SKILL.md" << STUBEOF
---
description: TODO: One-line description shown in VS Code command picker.
---
<command>$SKILL</command>
STUBEOF

echo "  ✓ Created _project-deploy/commands/$SKILL.md"

# 3. Create test scenario placeholder
cat > "tests/skill-scenarios/$SKILL.yaml" << YAMLEOF
skill: $SKILL
scenarios:
  - id: trigger-detection
    description: "TODO: Should trigger on primary keyword"
    input: "TODO: write a trigger phrase"
    expect:
      triggered: true
      contains: ["TODO: expected output string"]
      not_contains: ["TODO: string that must NOT appear"]

  - id: hard-rule-enforcement
    description: "TODO: Must enforce primary hard rule"
    input: "TODO: write an input that tests the hard rule"
    expect:
      triggered: true
      contains: ["TODO: expected gate/stop string"]
      not_contains: ["TODO: output that would indicate bypass"]
YAMLEOF

echo "  ✓ Created tests/skill-scenarios/$SKILL.yaml"

# 4. Register in plugin.json
python3 - << PYEOF
import json
with open('.claude-plugin/plugin.json') as f:
    p = json.load(f)
if '$SKILL' not in p['components']['skills']:
    p['components']['skills'].append('$SKILL')
    p['components']['skills'].sort()
with open('.claude-plugin/plugin.json', 'w') as f:
    json.dump(p, f, indent=2)
print("  ✓ Registered in plugin.json components.skills")
PYEOF

# 5. Add README placeholder row
python3 - << PYEOF
content = open('README.md').read()
marker = '| \`external-dir-map\`'
new_row = '| \`$SKILL\` | "TODO: trigger phrase" | TODO: description |\n'
if '$SKILL' not in content:
    content = content.replace(marker, new_row + marker)
    open('README.md', 'w').write(content)
    print("  ✓ Added placeholder row to README.md skills table (fill in TODO fields)")
else:
    print("  ℹ  README.md already mentions $SKILL — update manually")
PYEOF

# 6. Add source-file-consent.md row reminder
echo ""
echo "📋  Manual steps still required:"
echo "    1. Fill in all TODO fields in skills/$SKILL/SKILL.md"
echo "    2. Add a row for '$SKILL' to skills/shared/source-file-consent.md"
echo "    3. If this skill produces findings, add ledger support and reference"
echo "       skills/shared/dismissed-findings-reconciliation.md"
echo "    4. Update DEVELOPER-GUIDE.md if this skill introduces a new pattern"
echo "    5. Run: python3 tests/validate.py"
echo ""
echo "✅  Scaffold complete. Run 'python3 tests/validate.py' to check for remaining gaps."
