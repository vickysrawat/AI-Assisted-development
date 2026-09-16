# Bug Spec — version tooling references stale guide paths after `guides/` move

- **ID:** ADO-3190 (internal plugin maintenance — no external ADO ticket)
- **Tier:** T1
- **Status:** ✅ Approved
- **Approved by:** developer@example.com (chat approval, 2026-09-04)
- **Area:** release/version tooling

## Root Cause
The three HTML guides were consolidated into `guides/` (`git mv` of `plugin-guide.html`,
`user-guide.html`, and `docs/workflow/developer-guide.html`). Two release scripts still
reference the guides by their **old root paths** via a hardcoded list
`['plugin-guide.html', 'user-guide.html']`:
- `scripts/check-version-consistency.js:44`
- `scripts/bump-version.js:53`

Because both read with a fail-soft (`if (!h) continue;` / `if (!fs.existsSync(g)) continue;`),
the moved guides are silently skipped — `check-version-consistency.js` now prints
"✓ consistent" while checking **no guides at all** (a green-while-unverified regression).

## Fix
Replace each hardcoded 2-file list with a glob of `guides/*.html`, so every guide (and any
guide added later) is covered and none can be silently omitted:

```js
let guideFiles = [];
try { guideFiles = fs.readdirSync('guides').filter(f => f.endsWith('.html')).map(f => 'guides/' + f); } catch (e) { /* no guides/ */ }
for (const g of guideFiles) { ... }
```

This mirrors the same fix already applied to the floor-exempt tooling in this change
(`tests/validate.py` → `glob.glob("guides/*.html")`, `verify-plugin.sh` → `for _g in "$PLUGIN_DIR"/guides/*.html`).

## Regression Test
`node scripts/check-version-consistency.js` must, after the fix, emit a warning if any
`guides/*.html` documents a version other than `plugin.json`'s (verified by temporarily
editing a guide stamp), and must be silent/pass when all match. No hardcoded guide filename
remains in either script (`grep -n "plugin-guide.html', 'user-guide.html" scripts/*.js` → no
matches).
