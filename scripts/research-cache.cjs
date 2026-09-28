#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Machine-level cache for migration-research-agent bundles.
//                      Stores per-stack-pair research bundles (EoL, CVE, ecosystem, hiring,
//                      tooling facts) in a machine-local directory shared across all projects
//                      on the same machine. Avoids re-invoking the research agent on
//                      context-exhaustion re-runs and across separate migrations that share
//                      the same source→target stack pair.
//                      Three operations:
//                        lookup — exits 0 (usable hit: fresh or stale-warn), 1 (miss/expired)
//                        write  — stores a bundle from a file; atomic temp→rename
//                        expire — removes entries older than N days
//                      Two-tier staleness: warn at 30 days (still usable), hard-expire at 90 days.
// What it touches:     Reads/writes JSON files under the machine-level cache directory only:
//                        Windows:  %LOCALAPPDATA%\.claude\migration-research-cache\
//                        Linux:    $XDG_CACHE_HOME/.claude/migration-research-cache/
//                        macOS:    ~/Library/Caches/.claude/migration-research-cache/
//                        Fallback: ~/.claude/migration-research-cache/
//                      Never touches project files, repos, git, or the network.
// What it does NOT do: No network calls. No git. No project-level file writes.
//                      Does not modify any file outside the resolved cache directory.
//                      Does not read or interpret the bundle content — treats it as opaque JSON.
// APIs / commands:     Node stdlib: fs (sync JSON), path, os. No third-party dependencies.
// How to verify:       node tests/research-cache.test.cjs  -> "N passed · 0 failed"

'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SCHEMA_VERSION  = '1.0';
const WARN_AGE_DAYS   = 30;   // show staleness warning but still use the cache
const EXPIRE_AGE_DAYS = 90;   // delete and treat as miss

// DECISION: Machine-level cache location priority
// Options considered:
//   A) Project-level docs/migrations/{ADO}/research-cache/ — rejected: stack facts are not
//      project-specific; every migration re-fetches the same dotnet/java/node facts
//   B) Plugin installation dir — rejected: plugin is shared/read-only in some setups
//   C) Machine-level OS cache dir — chosen: shared across all projects on the machine,
//      not committed to any repo, survives project deletion
function resolveCacheDir() {
  if (process.env.LOCALAPPDATA)
    return path.join(process.env.LOCALAPPDATA, '.claude', 'migration-research-cache');
  if (process.env.XDG_CACHE_HOME)
    return path.join(process.env.XDG_CACHE_HOME, '.claude', 'migration-research-cache');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches', '.claude', 'migration-research-cache');
  return path.join(os.homedir(), '.claude', 'migration-research-cache');
}

// Cache key → safe filename. Non-alphanumeric chars replaced so the key is filesystem-safe.
function keyToFilename(key) {
  return key.replace(/[^a-zA-Z0-9.\-_]/g, '-') + '.json';
}

// Returns age in whole days between a YYYY-MM-DD string and today.
function ageInDays(dateStr) {
  const then = new Date(dateStr);
  const now  = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// Atomic write: write to temp file then rename — prevents a corrupt cache file on crash mid-write.
function saveCache(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

module.exports = { resolveCacheDir, keyToFilename, ageInDays, WARN_AGE_DAYS, EXPIRE_AGE_DAYS };

// ── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const OP       = (process.argv[2] || '').trim().toLowerCase();
  const JSON_OUT = process.argv.includes('--json');
  const arg      = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const CACHE_DIR = arg('cache-dir') || resolveCacheDir();

  try {
    let result, exit = 0;

    if (OP === 'lookup') {
      // Exits 0 = usable hit (fresh or stale-warn); 1 = miss (not found, corrupt, or expired).
      // On stale hit (30–90 days): exits 0 with staleness='stale' — caller should warn the developer.
      // On expired hit (>90 days): deletes the cache file and exits 1 with reason='expired'.
      const key = arg('key');
      if (!key) throw new Error('lookup requires --key');
      const file = path.join(CACHE_DIR, keyToFilename(key));

      if (!fs.existsSync(file)) {
        result = { op: 'lookup', status: 'miss', key, reason: 'not-found', cache_dir: CACHE_DIR };
        exit = 1;
      } else {
        let data;
        try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch (_) {
          try { fs.unlinkSync(file); } catch (__) {}
          result = { op: 'lookup', status: 'miss', key, reason: 'corrupt-deleted', cache_dir: CACHE_DIR };
          exit = 1;
        }
        if (data) {
          const age = ageInDays(data.generated_at || '1970-01-01');
          if (age > EXPIRE_AGE_DAYS) {
            try { fs.unlinkSync(file); } catch (_) {}
            result = { op: 'lookup', status: 'miss', key, reason: 'expired',
                       age_days: age, expire_threshold: EXPIRE_AGE_DAYS, cache_dir: CACHE_DIR };
            exit = 1;
          } else {
            const staleness = age > WARN_AGE_DAYS ? 'stale' : 'fresh';
            result = { op: 'lookup', status: 'hit', key, staleness, age_days: age,
                       warn_threshold: WARN_AGE_DAYS, expire_threshold: EXPIRE_AGE_DAYS,
                       cache_file: file, cache_dir: CACHE_DIR, entry: data };
          }
        }
      }

    } else if (OP === 'write') {
      // Writes a research bundle to the machine-level cache.
      // Bundle content comes from --bundle-file to avoid shell quoting failures on large JSON.
      const key           = arg('key');
      const bundleFile    = arg('bundle-file');
      const sourceStack   = arg('source-stack');
      const sourceVersion = arg('source-version');
      const targetStack   = arg('target-stack');
      const targetVersion = arg('target-version');

      if (!key)           throw new Error('write requires --key');
      if (!bundleFile)    throw new Error('write requires --bundle-file');
      if (!sourceStack)   throw new Error('write requires --source-stack');
      if (!sourceVersion) throw new Error('write requires --source-version');
      if (!targetStack)   throw new Error('write requires --target-stack');
      if (!targetVersion) throw new Error('write requires --target-version');
      if (!fs.existsSync(bundleFile))
        throw new Error(`bundle-file not found: ${bundleFile}`);

      let bundle;
      try { bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8')); }
      catch (e) { throw new Error(`bundle-file is not valid JSON: ${e.message}`); }

      const entry = {
        schema_version: SCHEMA_VERSION,
        generated_at:   new Date().toISOString().slice(0, 10),
        source_stack:   sourceStack,
        source_version: sourceVersion,
        target_stack:   targetStack,
        target_version: targetVersion,
        bundle,
      };

      const file = path.join(CACHE_DIR, keyToFilename(key));
      saveCache(file, entry);
      result = { op: 'write', status: 'ok', key, cache_file: file, cache_dir: CACHE_DIR, entry };

    } else if (OP === 'expire') {
      // Removes all cache entries older than --days (default: EXPIRE_AGE_DAYS).
      // Reports how many were removed vs kept. Skips unreadable files (listed under errors).
      const days = parseInt(arg('days') || String(EXPIRE_AGE_DAYS), 10);
      if (isNaN(days) || days < 1)
        throw new Error('expire requires --days=<positive integer>');

      let removed = 0, kept = 0, errors = [];
      if (fs.existsSync(CACHE_DIR)) {
        for (const f of fs.readdirSync(CACHE_DIR).filter(n => n.endsWith('.json'))) {
          const file = path.join(CACHE_DIR, f);
          try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (ageInDays(data.generated_at || '1970-01-01') > days) {
              fs.unlinkSync(file);
              removed++;
            } else {
              kept++;
            }
          } catch (_) {
            errors.push(f);
          }
        }
      }
      result = { op: 'expire', status: 'ok', days_threshold: days,
                 removed, kept, errors, cache_dir: CACHE_DIR };

    } else {
      process.stderr.write(
        'usage: research-cache.cjs <lookup|write|expire>\n' +
        '  lookup  --key=<key> [--cache-dir=<dir>] [--json]\n' +
        '  write   --key=<key> --bundle-file=<path>\n' +
        '          --source-stack=<s> --source-version=<v>\n' +
        '          --target-stack=<t> --target-version=<v> [--cache-dir=<dir>] [--json]\n' +
        '  expire  --days=<N> [--cache-dir=<dir>] [--json]\n'
      );
      process.exit(1);
    }

    if (JSON_OUT) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else {
      process.stdout.write(`op: ${result.op}\nstatus: ${result.status}\n`);
      if (result.age_days  !== undefined) process.stdout.write(`age_days: ${result.age_days}\n`);
      if (result.staleness !== undefined) process.stdout.write(`staleness: ${result.staleness}\n`);
      if (result.cache_file)              process.stdout.write(`cache_file: ${result.cache_file}\n`);
      if (result.removed   !== undefined) process.stdout.write(`removed: ${result.removed}\nkept: ${result.kept}\n`);
    }
    process.exit(exit);

  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}
