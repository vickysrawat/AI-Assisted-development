#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Deterministic scan of .md/.txt/.html files for generic "AI-sounding"
//                      writing patterns — stock vocabulary, weasel attribution, the
//                      "not just X, it's Y" negation, dangling "-ing" clauses, bold-lead-in
//                      bullet lists, transition/em-dash density, uniform sentence rhythm, and
//                      repeated paragraph openers. Prints tiered findings with file:line and a
//                      per-file risk band (clean/minor/moderate/high); --json writes the report.
// What it touches:     Reads the paths passed on argv (files or dirs, walked recursively).
//                      Writes only the optional --json output file. No repo state mutated.
// What it does NOT do: No network, no git, no npm deps (Node built-in fs/path only) — runs under
//                      restricted egress. Does NOT rewrite prose or judge argument quality.
// APIs / commands:     Node fs, path.
// How to verify:       node tests/check-tone.test.cjs  -> exit 0 and "N passed · 0 failed".

/**
 * check-tone.cjs — deterministic scan for generic "AI-sounding" writing patterns.
 *
 * Scope: catches the mechanical, checkable stuff (banned vocabulary, boilerplate
 * phrases, overused transitions, em-dash overuse, uniform sentence rhythm,
 * repeated paragraph openers, hedge-word clusters). It deliberately does NOT
 * try to judge voice, argument quality, or whether the content is actually
 * substantive — that's a job for a human or a qualitative pass on top of
 * this report, not for regex.
 *
 * Usage:
 *   node check-tone.cjs <file_or_dir> [<file_or_dir> ...] [--json out.json]
 *
 * Supports .md, .txt, .html (tags stripped) files. No npm dependencies —
 * only Node's built-in fs/path modules, so it runs under restricted egress.
 */

'use strict';

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

// Tier 1: near-unambiguous AI vocabulary / stock phrases. Flag every hit.
// Sourced in part from Wikipedia:Signs of AI writing (WikiProject AI Cleanup).
const TIER1_PHRASES = [
  "delve into", "boasts a", "testament to", "game-changer", "game changer",
  "cutting-edge", "cutting edge", "unlock the potential", "unlock its potential",
  "seamless", "seamlessly", "robust", "leverage", "harness the power",
  "in today's rapidly evolving", "in today's digital landscape",
  "elevate your", "foster a", "underscore", "navigate the complexities",
  "dive into", "unpack", "holistic approach", "paradigm shift", "revolutionize",
  "groundbreaking", "at the end of the day", "moving forward",
  "it is worth noting", "it's worth noting", "it is important to note",
  "it's important to note", "rich tapestry", "stands as a testament",
  "the future looks bright", "exciting times ahead", "in conclusion",
  "in summary", "plays a pivotal role", "plays a crucial role",
  "serves as a", "a testament to", "furthermore, it is",
  "let's delve", "look no further", "in the realm of", "when it comes to",
  "top-notch", "state-of-the-art",
  // promotional / "travel guide" puffery
  "rich cultural heritage", "enduring legacy", "breathtaking",
  "stunning natural beauty", "vibrant tapestry", "nestled in",
  "captivates both", "further enhancing its significance", "dynamic hub",
  "underscores its importance", "underscores its significance",
  "solidifying its", "cementing its", "reinforcing its",
  "no discussion would be complete without",
  // leftover chatbot/conversational artifacts — strong signal, treat as
  // the same severity as tier1 even though they're a different failure mode
  "i hope this helps", "as an ai language model", "as of my last update",
  "up to my last training update", "let me know if you", "certainly!",
  "i cannot browse the internet", "i don't have real-time",
];

// Tier 2: overused transitions — only flagged when frequency is high relative
// to document length (repetition is the signal, not the word itself).
const TRANSITION_WORDS = [
  "moreover", "furthermore", "additionally", "however", "consequently",
  "in addition", "on the other hand", "as a result", "notably",
];
const TRANSITION_DENSITY_THRESHOLD = 3.0; // per 1000 words before flagging

// Hedging clusters
const HEDGES = [
  "it could be argued", "some might say", "arguably", "one could say",
  "it goes without saying", "needless to say", "in many ways",
];

// Weasel / vague-attribution phrases — phantom authorities cited for claims.
// Flagged per hit, like hedges, since even one is usually a real signal.
const WEASEL_ATTRIBUTIONS = [
  "some critics argue", "observers have noted", "industry reports suggest",
  "experts agree", "studies show", "many believe", "it is widely regarded",
  "some experts believe", "many argue that", "critics have pointed out",
  "it has been suggested that", "reports indicate", "analysts suggest",
];

// Tailing "-ing" significance clauses: a factual clause followed by a
// present-participle phrase that gestures at importance without adding
// information (e.g. "...adoption of the standard, highlighting the need
// for interoperability.").
const TAILING_CLAUSE_MARKERS = [
  "highlighting", "underscoring", "showcasing", "reflecting",
  "solidifying", "cementing", "reinforcing", "emphasizing",
  "further demonstrating", "further highlighting",
];
const TAILING_CLAUSE_RE = new RegExp(
  ",\\s+(" + TAILING_CLAUSE_MARKERS.join("|") + ")\\s+[^.!?]*[.!?]",
  "gi"
);

// "It's not just X, it's Y" negation construction — Wikipedia's guide calls
// this one of the single most reliable AI tells.
const NEGATION_RE = /\bnot\s+(just|only)\b[^.!?]{0,80}\b(but|it'?s|it\s+is)\b/gi;

// Bold-lead-in bullet: "- **Term**: sentence" or "* **Term**: sentence".
// Three or more in a row is the ChatGPT-list signature; one or two is
// unremarkable formatting.
const BOLD_BULLET_RE = /^[ \t]*[-*]\s+\*\*[^*]+\*\*\s*:/gm;

const EM_DASH_DENSITY_THRESHOLD = 4.0; // per 1000 words

const WORD_RE = /[A-Za-z']+/g;

function stripHtml(text) {
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function loadText(filePath) {
  let raw = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") {
    raw = stripHtml(raw);
  }
  return raw;
}

function lineOfOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function findPhraseHits(text, phrases, tierLabel) {
  const hits = [];
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    let start = 0;
    while (true) {
      const idx = lower.indexOf(phrase, start);
      if (idx === -1) break;
      const snippet = text
        .slice(Math.max(0, idx - 20), idx + phrase.length + 20)
        .trim()
        .replace(/\s+/g, " ");
      hits.push({
        tier: tierLabel,
        pattern: phrase,
        line: lineOfOffset(text, idx),
        snippet,
      });
      start = idx + phrase.length;
    }
  }
  return hits;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pstdev(arr) {
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

function splitSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace + capital/number/quote
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function analyzeDocument(text) {
  const words = text.match(WORD_RE) || [];
  const wordCount = Math.max(words.length, 1);
  const per1000 = 1000.0 / wordCount;

  let findings = [];
  findings = findings.concat(findPhraseHits(text, TIER1_PHRASES, "tier1"));
  findings = findings.concat(findPhraseHits(text, HEDGES, "hedge"));
  findings = findings.concat(findPhraseHits(text, WEASEL_ATTRIBUTIONS, "weasel"));

  // Negation construction ("not just X, it's Y")
  for (const m of text.matchAll(NEGATION_RE)) {
    findings.push({
      tier: "negation_construction",
      pattern: "not-just-X-but-Y construction",
      line: lineOfOffset(text, m.index),
      snippet: text.slice(m.index, m.index + m[0].length).replace(/\s+/g, " "),
    });
  }

  // Tailing "-ing" significance clauses
  for (const m of text.matchAll(TAILING_CLAUSE_RE)) {
    findings.push({
      tier: "tailing_clause",
      pattern: `dangling "${m[1]}" significance clause`,
      line: lineOfOffset(text, m.index),
      snippet: text.slice(m.index, m.index + m[0].length).replace(/\s+/g, " "),
    });
  }

  // Bold-lead-in bullet lists, 3+ in a row
  const boldBulletMatches = [...text.matchAll(BOLD_BULLET_RE)];
  if (boldBulletMatches.length >= 3) {
    // Only flag runs of 3+ within ~15 lines of each other, not scattered
    // bold bullets across an unrelated document.
    const lines = boldBulletMatches.map((m) => lineOfOffset(text, m.index));
    let runStart = 0;
    for (let i = 1; i <= lines.length; i++) {
      const brokeRun = i === lines.length || lines[i] - lines[i - 1] > 15;
      if (brokeRun) {
        const runLen = i - runStart;
        if (runLen >= 3) {
          findings.push({
            tier: "bold_bullet_list",
            pattern: "bold-lead-in bullet list (ChatGPT list signature)",
            line: lines[runStart],
            snippet: `${runLen} consecutive "- **Term**: ..." bullets starting at line ${lines[runStart]}`,
          });
        }
        runStart = i;
      }
    }
  }

  // Transition density (aggregate, not per-hit — a single use is fine)
  const transitionHits = findPhraseHits(text, TRANSITION_WORDS, "transition");
  const transitionDensity = transitionHits.length * per1000;
  if (transitionDensity > TRANSITION_DENSITY_THRESHOLD) {
    findings.push({
      tier: "transition_density",
      pattern: "overused transitions",
      line: null,
      snippet: `${transitionHits.length} hits (${transitionDensity.toFixed(
        1
      )} per 1000 words, threshold ${TRANSITION_DENSITY_THRESHOLD})`,
    });
  }

  // Em-dash density
  const emDashCount = (text.match(/—/g) || []).length + (text.match(/--/g) || []).length;
  const emDashDensity = emDashCount * per1000;
  if (emDashDensity > EM_DASH_DENSITY_THRESHOLD) {
    findings.push({
      tier: "em_dash_density",
      pattern: "em-dash overuse",
      line: null,
      snippet: `${emDashCount} em-dashes (${emDashDensity.toFixed(
        1
      )} per 1000 words, threshold ${EM_DASH_DENSITY_THRESHOLD})`,
    });
  }

  // Sentence-length uniformity ("staccato" AI rhythm)
  const sentences = splitSentences(text);
  const lengths = sentences
    .map((s) => (s.match(WORD_RE) || []).length)
    .filter((n) => n > 0);
  if (lengths.length >= 8) {
    const meanLen = mean(lengths);
    const stdevLen = pstdev(lengths);
    if (meanLen >= 6 && meanLen <= 22 && stdevLen < 3.0) {
      findings.push({
        tier: "uniform_rhythm",
        pattern: "uniform sentence length",
        line: null,
        snippet: `${lengths.length} sentences, mean ${meanLen.toFixed(
          1
        )} words, stdev ${stdevLen.toFixed(1)} (low variance reads as robotic)`,
      });
    }
  }

  // Repeated paragraph openers
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const openers = {};
  for (const p of paras) {
    const firstWords = (p.match(WORD_RE) || []).slice(0, 2).join(" ").toLowerCase();
    if (firstWords) {
      openers[firstWords] = (openers[firstWords] || 0) + 1;
    }
  }
  for (const [opener, count] of Object.entries(openers)) {
    if (count >= 3) {
      findings.push({
        tier: "repeated_opener",
        pattern: `paragraphs starting with "${opener}..."`,
        line: null,
        snippet: `${count} paragraphs share this opener`,
      });
    }
  }

  return {
    word_count: wordCount,
    sentence_count: sentences.length,
    findings,
  };
}

// Strong-signal tiers count double toward the risk score — these are the
// patterns Wikipedia's AI Cleanup project treats as most reliable on their
// own (stock vocabulary, phantom-authority attribution, chatbot leftovers,
// the "not just X, it's Y" negation construction).
const HIGH_WEIGHT_TIERS = new Set([
  "tier1", "hedge", "weasel", "negation_construction",
]);

function score(findings) {
  const highWeightCount = findings.filter((f) => HIGH_WEIGHT_TIERS.has(f.tier)).length;
  const structuralCount = findings.length - highWeightCount;
  const total = highWeightCount * 2 + structuralCount;
  if (total === 0) return "clean";
  if (total <= 3) return "minor";
  if (total <= 8) return "moderate";
  return "high";
}

function collectFiles(paths) {
  const exts = new Set([".md", ".markdown", ".txt", ".html", ".htm"]);
  const files = [];

  function walk(p) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p).sort()) {
        walk(path.join(p, entry));
      }
    } else if (stat.isFile()) {
      if (exts.has(path.extname(p).toLowerCase())) {
        files.push(p);
      }
    }
  }

  for (const p of paths) {
    if (fs.existsSync(p)) {
      walk(p);
    } else {
      console.error(`warning: path not found: ${p}`);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  let jsonOut = null;
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") {
      jsonOut = args[i + 1];
      i++;
    } else {
      paths.push(args[i]);
    }
  }

  if (paths.length === 0) {
    console.error(
      "Usage: node check-tone.cjs <file_or_dir> [<file_or_dir> ...] [--json out.json]"
    );
    process.exit(1);
  }

  const files = collectFiles(paths);
  if (files.length === 0) {
    console.error("No .md/.txt/.html files found at given paths.");
    process.exit(1);
  }

  const report = {};
  for (const f of files) {
    const text = loadText(f);
    const result = analyzeDocument(text);
    result.risk = score(result.findings);
    report[f] = result;
  }

  for (const [fname, result] of Object.entries(report)) {
    console.log(
      `\n=== ${fname} (${result.word_count} words, risk: ${result.risk}) ===`
    );
    if (result.findings.length === 0) {
      console.log("  clean — no mechanical AI-writing patterns detected");
      continue;
    }
    const sorted = [...result.findings].sort((a, b) => {
      const aTier1 = a.tier === "tier1" ? 0 : 1;
      const bTier1 = b.tier === "tier1" ? 0 : 1;
      if (aTier1 !== bTier1) return aTier1 - bTier1;
      return (a.line || 0) - (b.line || 0);
    });
    for (const f of sorted) {
      const loc = f.line ? `line ${f.line}` : "(document-level)";
      console.log(`  [${f.tier}] ${loc}: ${f.pattern}`);
      console.log(`      → ${f.snippet}`);
    }
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nFull JSON report written to ${jsonOut}`);
  }
}

main();
