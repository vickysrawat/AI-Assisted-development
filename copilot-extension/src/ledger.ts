/**
 * ledger.ts — Session-persistent checkpoint storage for the Migration Family.
 *
 * Wraps checkpoint-ledger.cjs (vendored under scripts/) via require() to store
 * in-flight skill state in VS Code's globalStorageUri. State written here
 * survives VS Code window reloads, unlike the module-level Maps in each skill
 * handler which reset when the extension is reloaded.
 *
 * How the two layers interact:
 *   - Module-level Maps in upgradeHandler / rewriteHandler: fast, in-memory, reset on reload.
 *   - Ledger (this file): JSON on disk, survives reloads, used to restore the Maps.
 *
 * On each checkAndResumePending call: if the in-memory Map is empty for an adoId,
 * the handler calls readCheckpoint() to restore the Map entry from disk.
 * When a pending state resolves: clearCheckpoint() removes the persisted entry.
 *
 * Checkpoint file location: {context.globalStorageUri}/{adoId}.checkpoint.json
 * VS Code manages this directory per extension — it is NOT inside the user's workspace.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single persisted migration checkpoint for one ADO work item + skill. */
export interface MigrationCheckpoint {
  adoId:     string;
  skill:     'upgrade' | 'rewrite' | 'replatform';
  stage:     string;
  /** Opaque pending-state data; each skill casts this to its own pending interface. */
  data:      Record<string, unknown>;
  updatedAt: string;
}

/** Subset of the checkpoint-ledger.cjs library API used by this module. */
interface LedgerLib {
  coreEnvelope(opts: { skill: string; ado: string; now: string }): Record<string, unknown>;
  load(file: string): Record<string, unknown> | null;
  save(file: string, cp: Record<string, unknown>): void;
  setPayload(
    cp: Record<string, unknown>,
    skill: string,
    patch: Record<string, unknown>,
    now: string
  ): Record<string, unknown>;
}

// ── Module loader ─────────────────────────────────────────────────────────────

/** Cached require result — loaded once per VS Code session. */
let _lib: LedgerLib | null = null;

/**
 * Loads checkpoint-ledger.cjs via require().
 * Uses extensionUri to resolve the vendored script path at runtime.
 * Cached after the first call — require() is only invoked once per session.
 */
function getLib(extensionUri: vscode.Uri): LedgerLib {
  if (!_lib) {
    const scriptPath = path.join(extensionUri.fsPath, 'scripts', 'checkpoint-ledger.cjs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _lib = require(scriptPath) as LedgerLib;
  }
  return _lib;
}

// ── Path helper ───────────────────────────────────────────────────────────────

/**
 * Returns the absolute file path for the checkpoint JSON for the given ADO ID.
 * All checkpoints live in VS Code's extension-managed global storage.
 */
function filePath(storageUri: vscode.Uri, adoId: string): string {
  return path.join(storageUri.fsPath, `${adoId}.checkpoint.json`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persists a migration checkpoint to disk.
 *
 * Call this when a skill enters a blocking pending state (e.g. HIGH_RISK_ACK_PENDING).
 * Uses the checkpoint-ledger.cjs merge-write pattern so multiple skills sharing one
 * ADO checkpoint file never clobber each other's payload keys.
 *
 * @param context     VS Code extension context (provides extensionUri + globalStorageUri).
 * @param checkpoint  The checkpoint data to persist.
 */
export function writeCheckpoint(
  context: vscode.ExtensionContext,
  checkpoint: MigrationCheckpoint
): void {
  const lib  = getLib(context.extensionUri);
  const file = filePath(context.globalStorageUri, checkpoint.adoId);

  // VS Code does not pre-create globalStorageUri — ensure the directory exists.
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });

  const now = new Date().toISOString();

  // Load existing checkpoint or create a fresh core envelope.
  let cp = lib.load(file);
  if (!cp) {
    cp = lib.coreEnvelope({ skill: checkpoint.skill, ado: checkpoint.adoId, now });
  }

  // Store pending state in the skill's payload namespace.
  // merge-write ensures other skills' keys are preserved untouched.
  const patch: Record<string, unknown> = {
    stage:     checkpoint.stage,
    data:      checkpoint.data,
    updatedAt: checkpoint.updatedAt,
  };
  const updated = lib.setPayload(cp, checkpoint.skill, patch, now);
  lib.save(file, updated);
}

/**
 * Reads a persisted checkpoint for the given ADO ID and skill.
 * Returns null when no checkpoint exists or the skill has no recorded pending state.
 *
 * Callers use this to restore in-memory Maps after a window reload:
 *   const saved = readCheckpoint(context, adoId, 'upgrade');
 *   if (saved?.stage === 'HIGH_RISK_ACK_PENDING') { ... }
 *
 * @param context  VS Code extension context.
 * @param adoId    ADO work item ID to look up.
 * @param skill    Skill whose payload to read.
 */
export function readCheckpoint(
  context: vscode.ExtensionContext,
  adoId: string,
  skill: MigrationCheckpoint['skill']
): MigrationCheckpoint | null {
  const lib  = getLib(context.extensionUri);
  const file = filePath(context.globalStorageUri, adoId);
  const cp   = lib.load(file);
  if (!cp) { return null; }

  // Navigate to the skill's payload namespace inside the envelope.
  const payloadMap = cp['payload'] as Record<string, Record<string, unknown>> | undefined;
  const payload    = payloadMap?.[skill];
  if (!payload || !payload['stage']) { return null; }

  return {
    adoId,
    skill,
    stage:     String(payload['stage']),
    data:      (payload['data'] as Record<string, unknown>) ?? {},
    updatedAt: String(payload['updatedAt'] ?? ''),
  };
}

/**
 * Deletes the persisted checkpoint file for the given ADO ID.
 *
 * Call this when a pending state resolves successfully so stale state does not
 * linger across sessions. No-op if the file does not exist.
 *
 * @param context  VS Code extension context.
 * @param adoId    ADO work item ID to clear.
 */
export function clearCheckpoint(
  context: vscode.ExtensionContext,
  adoId: string
): void {
  const file = filePath(context.globalStorageUri, adoId);
  try {
    fs.unlinkSync(file);
  } catch {
    // File does not exist — nothing to clear; expected after a clean migration run.
  }
}

/**
 * Returns the ADO IDs of all active migration checkpoints on disk.
 *
 * Used by participant.ts to show a helpful message when the developer sends a gate
 * response ("YES", a bare option number, a version string) without an ADO ID after
 * a VS Code window reload. In-memory Maps reset on reload, so the ledger directory
 * is the only persistent source of truth for which ADO IDs have pending state.
 *
 * Returns an empty array when the global storage directory does not yet exist
 * (first run) or when no checkpoint files are present.
 *
 * @param context  VS Code extension context.
 */
export function listActiveAdoIds(context: vscode.ExtensionContext): string[] {
  try {
    const dir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(dir)) { return []; }
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.checkpoint.json'))
      .map(f => f.slice(0, -'.checkpoint.json'.length));
  } catch {
    return [];
  }
}
