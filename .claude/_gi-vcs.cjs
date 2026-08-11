// SCRIPT REVIEW
// What it does:        Detects whether this repo uses Git or TFVC and prints VCS= and IGNORE_FILE= lines
// What it touches:     Nothing — read-only detection
// What it does NOT do: No file writes, no network calls, no git operations
// APIs / commands:     child_process.execSync (git rev-parse), fs.existsSync
// How to verify:       Check output for VCS=git or VCS=tfvc

const { execSync } = require('child_process');
const fs = require('fs');
function gitTree(){ try { execSync('git rev-parse --is-inside-work-tree', {stdio:'ignore'}); return true; } catch { return false; } }
function tfvc(){
  try { execSync('tf vc status .', {stdio:'ignore'}); return true; } catch {}
  if (fs.existsSync('$tf') || fs.existsSync('.tf') || fs.existsSync('.tfignore')) return true;
  return false;
}
let vcs = gitTree() ? 'git' : (tfvc() ? 'tfvc' : 'none');
console.log('VCS=' + vcs);
console.log('IGNORE_FILE=' + (vcs === 'tfvc' ? '.tfignore' : '.gitignore'));
