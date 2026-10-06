#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Exports normalizeAdo(input) — converts any ADO identifier form
//                      ('1234', 'ADO-1234', 'ado-1234', 'ADO1234') to the canonical
//                      'ADO-1234' format. Returns null for unrecognised inputs.
//                      Used by approval-capture.cjs and migration-gate.cjs so that
//                      ADO identifier parsing is never duplicated inline.
// What it touches:     Nothing — pure function, no file I/O, no network, no side effects.
// What it does NOT do: No file reads or writes, no network calls, no process.exit calls.
// APIs / commands:     Node stdlib: String, RegExp only. No third-party dependencies.
// How to verify:       node -e "const {normalizeAdo}=require('./scripts/ado-normalize.cjs');
//                      console.log(normalizeAdo('1234'), normalizeAdo('ADO-5678'), normalizeAdo('bad'))"
//                      Expected output: ADO-1234  ADO-5678  null

'use strict';

/**
 * Converts any ADO identifier form to the canonical ADO-<id> format.
 *
 * Accepted input forms:
 *   '1234'      → 'ADO-1234'
 *   'ADO-1234'  → 'ADO-1234'
 *   'ado-1234'  → 'ADO-1234'
 *   'ADO1234'   → 'ADO-1234'
 *
 * Returns null if the input is falsy or does not match any recognised form.
 */
function normalizeAdo(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(?:ADO-?)?(\d+)$/i);
  if (!m) return null;
  return 'ADO-' + m[1];
}

module.exports = { normalizeAdo };
