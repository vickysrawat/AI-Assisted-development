#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Pure source-authority classifier for the migration-knowledge family. Given a
//                      stack and a source URL, decides whether a grounded fact is VERIFIED (traced to
//                      an authoritative official domain) or INFERRED (unknown/weak host), and derives
//                      a tier-appropriate confidence. Single source of truth shared by
//                      upgrade-knowledge-cache.cjs (fact caching) and knowledge-freshness.cjs (ref
//                      re-tagging on refresh).
// What it touches:     Nothing — pure functions over their arguments. No file, network, or process IO.
// What it does NOT do: NO network, NO fs, NO git, NO LLM call. Never fabricates authority — an
//                      unknown host is always INFERRED (skeptical default).
// APIs / commands:     Library module (no CLI). Exports classifySource, confidenceFor, hostOf,
//                      AUTHORITATIVE via module.exports.
// How to verify:       node tests/upgrade-knowledge-cache.test.cjs -> "N passed · 0 failed"
//                      (exercises classifySource/confidenceFor through the cache); and
//                      node tests/knowledge-freshness.test.cjs      -> "N passed · 0 failed".

'use strict';

// ── Authoritative-source policy (source verification) ──────────
// A claim is VERIFIED only when traced to an AUTHORITATIVE source (official migration guide /
// release notes / deprecation list), else INFERRED. Per-stack official domains are the allowlist.
// DECISION: how to decide whether a source makes a fact VERIFIED
// Options considered:
//   A) any URL with a "migration"/"breaking-change" path segment — rejected: a random blog post at
//      /breaking-changes would be trusted as authoritative; that is exactly the fabrication risk
//      the tag is meant to catch
//   B) LLM judges authority at call time — rejected here: non-deterministic, un-unit-testable; the
//      LLM-as-judge layer is a separate concern; this classifier must be reproducible
//   C) per-stack official-domain allowlist (skeptical default: unknown host => INFERRED) — chosen:
//      deterministic, testable, and conservative — it never over-trusts
const AUTHORITATIVE = {
  dotnet:  [/(^|\.)learn\.microsoft\.com$/i, /(^|\.)devblogs\.microsoft\.com$/i, /(^|\.)dotnet\.microsoft\.com$/i, /(^|\.)github\.com$/i],
  angular: [/(^|\.)angular\.(io|dev)$/i, /(^|\.)update\.angular\.(io|dev)$/i, /(^|\.)blog\.angular\.(io|dev)$/i, /(^|\.)github\.com$/i],
  java:    [/(^|\.)openjdk\.org$/i, /(^|\.)docs\.oracle\.com$/i, /(^|\.)oracle\.com$/i, /(^|\.)docs\.openrewrite\.org$/i, /(^|\.)github\.com$/i],
  python:  [/(^|\.)docs\.python\.org$/i, /(^|\.)peps\.python\.org$/i, /(^|\.)python\.org$/i],
  nodejs:  [/(^|\.)nodejs\.org$/i, /(^|\.)github\.com$/i],
  react:   [/(^|\.)react\.dev$/i, /(^|\.)legacy\.reactjs\.org$/i, /(^|\.)github\.com$/i],
};

function hostOf(url) {
  const m = /^[a-z]+:\/\/([^/?#]+)/i.exec(url || '');
  return m ? m[1].toLowerCase().replace(/:\d+$/, '') : '';
}

// Pure — classify a source for a stack. No IO. Used by the cache `put`/`tag` ops, the freshness
// `refresh` re-tag, and unit tests.
function classifySource(stack, source) {
  const host = hostOf(source);
  if (!source || !host) return { tier: 'INFERRED', authoritative: false, host: host || null };
  const patterns = AUTHORITATIVE[stack] || [];
  const authoritative = patterns.some(re => re.test(host));
  return { tier: authoritative ? 'VERIFIED' : 'INFERRED', authoritative, host };
}

// Confidence follows the tier: VERIFIED sits high; INFERRED is always LOWERED and capped so an
// unverified claim can never present as high-confidence (the honest-uncertainty requirement).
function confidenceFor(tier, provided) {
  const p = Number(provided);
  if (tier === 'VERIFIED') return Number.isFinite(p) ? Math.min(Math.max(p, 0.8), 1.0) : 0.95;
  return Number.isFinite(p) ? Math.min(p, 0.5) : 0.4;
}

module.exports = { classifySource, confidenceFor, hostOf, AUTHORITATIVE };
