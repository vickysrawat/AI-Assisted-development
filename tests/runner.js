#!/usr/bin/env node
/**
 * ai-assisted-development plugin — skill test runner
 * Usage: node tests/runner.js [--skill <name>] [--verbose]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ARGS = process.argv.slice(2);
const SKILL_FILTER = ARGS.includes("--skill") ? ARGS[ARGS.indexOf("--skill") + 1] : null;
const VERBOSE = ARGS.includes("--verbose");
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

// ── YAML parser (minimal — handles our scenario format) ──────────────────────
function parseYaml(text) {
  const lines = text.split("\n");
  const result = { skill: "", scenarios: [] };
  let current = null;
  let inExpect = false;
  let inContains = false;
  let inNotContains = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();

    if (trimmed.startsWith("skill:")) {
      result.skill = trimmed.replace("skill:", "").trim().replace(/'/g, "");
    } else if (trimmed === "scenarios:") {
      current = null;
    } else if (trimmed.startsWith("- id:")) {
      current = { id: trimmed.replace("- id:", "").trim().replace(/'/g, ""), description: "", input: "", expect: { triggered: true, contains: [], not_contains: [] } };
      result.scenarios.push(current);
      inExpect = false; inContains = false; inNotContains = false;
    } else if (current && trimmed.startsWith("description:")) {
      current.description = trimmed.replace("description:", "").trim().replace(/"/g, "");
    } else if (current && trimmed.startsWith("input:")) {
      const val = trimmed.replace("input:", "").trim();
      current.input = val.startsWith("|") ? "" : val.replace(/"/g, "");
    } else if (current && current.input === "" && indent >= 6 && !trimmed.startsWith("expect:") && !trimmed.startsWith("contains:") && !trimmed.startsWith("not_contains:") && !trimmed.startsWith("triggered:")) {
      current.input += (current.input ? "\n" : "") + trimmed;
    } else if (current && trimmed.startsWith("expect:")) {
      inExpect = true; inContains = false; inNotContains = false;
    } else if (inExpect && trimmed.startsWith("triggered:")) {
      current.expect.triggered = !trimmed.includes("false");
    } else if (inExpect && trimmed.startsWith("contains:")) {
      inContains = true; inNotContains = false;
    } else if (inExpect && trimmed.startsWith("not_contains:")) {
      inNotContains = true; inContains = false;
    } else if (inContains && trimmed.startsWith('- "')) {
      current.expect.contains.push(trimmed.slice(3, -1));
    } else if (inNotContains && trimmed.startsWith('- "')) {
      current.expect.not_contains.push(trimmed.slice(3, -1));
    }
  }
  return result;
}

// ── Load skill SKILL.md content ───────────────────────────────────────────────
function loadSkill(skillName) {
  const p = path.join(__dirname, "..", "skills", skillName, "SKILL.md");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

// ── Anthropic API call ────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Run a single scenario ─────────────────────────────────────────────────────
async function runScenario(skillContent, scenario) {
  const system = `You are operating with the following skill instructions. Follow them exactly.\n\n${skillContent}`;
  const response = await callClaude(system, scenario.input);

  const failures = [];

  if (scenario.expect.triggered) {
    // At minimum some substantive response expected
    if (response.trim().length < 50) failures.push("Response too short — skill may not have triggered");
  }

  for (const term of scenario.expect.contains) {
    if (!response.toLowerCase().includes(term.toLowerCase())) {
      failures.push(`Expected to contain: "${term}"`);
    }
  }

  for (const term of scenario.expect.not_contains) {
    if (response.toLowerCase().includes(term.toLowerCase())) {
      failures.push(`Expected NOT to contain: "${term}"`);
    }
  }

  return { passed: failures.length === 0, failures, response };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const scenarioDir = path.join(__dirname, "skill-scenarios");
  if (!fs.existsSync(scenarioDir)) {
    console.error("✗ No skill-scenarios/ folder found. Run from plugin root.");
    process.exit(1);
  }

  const files = fs.readdirSync(scenarioDir).filter(f => f.endsWith(".yaml"));
  const filtered = SKILL_FILTER ? files.filter(f => f.startsWith(SKILL_FILTER)) : files;

  if (filtered.length === 0) {
    console.log(`No scenario files found${SKILL_FILTER ? ` for skill: ${SKILL_FILTER}` : ""}`);
    process.exit(0);
  }

  let totalPass = 0, totalFail = 0;
  const results = [];

  for (const file of filtered) {
    const yaml = fs.readFileSync(path.join(scenarioDir, file), "utf8");
    const { skill, scenarios } = parseYaml(yaml);
    const skillContent = loadSkill(skill);

    if (!skillContent) {
      console.log(`⚠  Skill not found: ${skill} — skipping ${file}`);
      continue;
    }

    console.log(`\n▶ ${skill} (${scenarios.length} scenarios)`);

    for (const scenario of scenarios) {
      process.stdout.write(`  ${scenario.id} ... `);
      try {
        const { passed, failures, response } = await runScenario(skillContent, scenario);
        if (passed) {
          console.log("✓ passed");
          totalPass++;
        } else {
          console.log(`✗ FAILED`);
          failures.forEach(f => console.log(`    → ${f}`));
          totalFail++;
        }
        if (VERBOSE) console.log(`  Response preview: ${response.slice(0, 200).replace(/\n/g, " ")}...`);
        results.push({ skill, scenario: scenario.id, passed, failures });
      } catch (err) {
        console.log(`✗ ERROR: ${err.message}`);
        totalFail++;
        results.push({ skill, scenario: scenario.id, passed: false, failures: [err.message] });
      }
    }
  }

  // Write results
  const resultsDir = path.join(__dirname, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDir, "last-run.json"),
    JSON.stringify({ date: new Date().toISOString(), pass: totalPass, fail: totalFail, results }, null, 2)
  );

  console.log(`\n${"━".repeat(44)}`);
  console.log(`  Results: ${totalPass} passed · ${totalFail} failed`);
  console.log(`  Report:  tests/results/last-run.json`);
  console.log(`${"━".repeat(44)}`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
