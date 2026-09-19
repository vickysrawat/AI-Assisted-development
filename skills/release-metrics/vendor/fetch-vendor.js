// One-time vendor setup: downloads Chart.js 4.x minified and saves it locally
// Run: node fetch-vendor.js
// Requires Node.js with https module (built-in)

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
const EXPECTED_SHA256 = null; // set to verified hash after first download if desired
const OUT_FILE = path.join(__dirname, 'chart.min.js');

if (fs.existsSync(OUT_FILE)) {
  console.log('chart.min.js already exists — delete it first to re-download.');
  process.exit(0);
}

console.log('Downloading Chart.js 4.4.3 from jsdelivr...');
https.get(CHART_JS_URL, res => {
  if (res.statusCode !== 200) {
    console.error('Download failed: HTTP', res.statusCode);
    process.exit(1);
  }
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (EXPECTED_SHA256) {
      const actual = crypto.createHash('sha256').update(buf).digest('hex');
      if (actual !== EXPECTED_SHA256) {
        console.error('SHA-256 mismatch — file not saved. Expected:', EXPECTED_SHA256, 'Got:', actual);
        process.exit(1);
      }
    }
    fs.writeFileSync(OUT_FILE, buf);
    const kb = Math.round(buf.length / 1024);
    console.log(`Saved chart.min.js (${kb} KB) — HTML reports will now render offline.`);
  });
}).on('error', err => {
  console.error('Download error:', err.message);
  process.exit(1);
});
