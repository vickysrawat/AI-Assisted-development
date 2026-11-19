#!/usr/bin/env node
// SCRIPT REVIEW
// What it does:        Builds the Azure icon PNGs that /arch-diagram draws. Reads
//                      assets/icons/azure/manifest.json, checks that every icon's source SVG
//                      is in the extracted Microsoft download (and stops, naming each missing
//                      one, before rendering anything), then renders each SVG to a square PNG
//                      ("size" pixels, transparent background) with headless Edge or Chrome
//                      and checks the PNG's dimensions. Maintainer-only: the skill and its
//                      users never run it; the PNGs are committed.
// What it touches:     Reads manifest.json and the source SVGs. Writes
//                      assets/icons/azure/<file>.png for each manifest entry, plus a temporary
//                      HTML page and browser profile in the OS temp folder, deleted before exit.
// What it does NOT do: No network calls, no git commands. Does not edit manifest.json and does
//                      not delete PNGs that are no longer listed in it.
// APIs / commands:     Node stdlib: fs, os, path, child_process.execFileSync (runs the browser
//                      with --headless --screenshot). module.exports for tests.
// How to verify:       node scripts/build-azure-icons.cjs "<download>/Azure_Public_Service_Icons/Icons"
//                      -> one line per icon, then "built 34 icons", exit 0. Each PNG in
//                      assets/icons/azure/ opens as the icon on a transparent background.
// ADO-82 (Story 1): AC-F1 (bundled assets), AC-F5 (repeatable conversion).

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ICON_DIR = path.join(__dirname, '..', 'assets', 'icons', 'azure');
const MANIFEST = path.join(ICON_DIR, 'manifest.json');
const RENDER_TIMEOUT_MS = 120000; // a cold headless start on a managed Windows machine can take a minute
const PNG_SIGNATURE = '89504e470d0a1a0a';

// Usual install locations, checked in order when --browser is not given.
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/** Reads the icon list (name, PNG file name, source SVG path) from manifest.json. */
function loadManifest(file = MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isInteger(manifest.size) || !Array.isArray(manifest.icons)) {
    throw new Error(`${file}: needs a whole-number "size" and an "icons" list`);
  }
  return manifest;
}

/** Lists the manifest entries whose source SVG is not in the extracted download folder. */
function findMissingSources(manifest, iconsRoot) {
  return manifest.icons
    .filter((icon) => !fs.existsSync(path.join(iconsRoot, icon.source)))
    .map((icon) => `${icon.name} (${icon.source})`);
}

/** Picks the browser: the --browser path if one was given, else the first known install found. */
function findBrowser(explicit) {
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  return BROWSERS.find((candidate) => fs.existsSync(candidate)) || null;
}

/** Reads a PNG's width and height from its header; returns null if the bytes are not a PNG. */
function pngSize(bytes) {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Draws one SVG into a square PNG of `size` pixels on a transparent background, then checks it. */
function renderIcon(browser, svgFile, pngFile, size, workDir) {
  // DECISION: How to turn the Microsoft SVGs into PNGs
  // Options considered:
  //   A) cairosvg / Inkscape — rejected: a native install the maintainer may not have (cairo DLLs on Windows)
  //   B) sharp / resvg npm package — rejected: a new dependency in the plugin repo for a one-off build
  //   C) Headless Edge or Chrome screenshot — chosen: already on every maintainer machine, renders
  //      the SVG exactly as a browser does, and needs nothing installed
  const svg = fs.readFileSync(svgFile).toString('base64');
  const page = path.join(workDir, 'icon.html');
  fs.writeFileSync(
    page,
    '<!doctype html><html><body style="margin:0;background:transparent">' +
      `<img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block">` +
      '</body></html>',
  );
  fs.rmSync(pngFile, { force: true }); // so a failed render can't leave the old PNG looking current
  execFileSync(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      `--user-data-dir=${path.join(workDir, 'profile')}`, // never touches the maintainer's own browser profile
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${size},${size}`,
      `--screenshot=${pngFile}`,
      'file:///' + page.replace(/\\/g, '/'),
    ],
    { stdio: 'ignore', timeout: RENDER_TIMEOUT_MS },
  );
  const got = fs.existsSync(pngFile) ? pngSize(fs.readFileSync(pngFile)) : null;
  if (!got || got.width !== size || got.height !== size) {
    const found = got ? `${got.width} x ${got.height}` : 'no PNG';
    throw new Error(`${path.basename(pngFile)}: expected a ${size} x ${size} PNG, got ${found}`);
  }
}

/** Command line: checks every source first, then renders every icon in manifest order. */
function main(argv) {
  const args = argv.slice(2);
  let explicitBrowser = null;
  const flag = args.indexOf('--browser');
  if (flag >= 0) {
    explicitBrowser = args[flag + 1];
    args.splice(flag, 2);
  }
  if (args.length !== 1 || (flag >= 0 && !explicitBrowser)) {
    console.error('usage: node scripts/build-azure-icons.cjs <extracted Icons folder> [--browser <path>]');
    return 2;
  }
  const iconsRoot = args[0];
  const manifest = loadManifest();

  const missing = findMissingSources(manifest, iconsRoot);
  if (missing.length) {
    console.error(`missing source SVG for ${missing.length} icon(s) — nothing was built:\n  ${missing.join('\n  ')}`);
    return 1;
  }
  const browser = findBrowser(explicitBrowser);
  if (!browser) {
    console.error('no Edge or Chrome found — pass --browser <path to the browser executable>');
    return 1;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-icons-'));
  try {
    for (const icon of manifest.icons) {
      renderIcon(browser, path.join(iconsRoot, icon.source), path.join(ICON_DIR, icon.file), manifest.size, workDir);
      console.log(`  ${icon.file}`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  console.log(`built ${manifest.icons.length} icons`);
  return 0;
}

module.exports = { loadManifest, findMissingSources, findBrowser, pngSize };

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
