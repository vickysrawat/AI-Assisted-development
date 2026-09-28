# Plan: Code Review HTML — UX Fixes + Template Integration

## Context

During this session we made three UX improvements to `CodeReviews/code-review-2026-07-16.html`:
1. **Header-only toggle** — clicking anywhere in an expanded finding was collapsing it; fixed so only the header row triggers expand/collapse.
2. **Copyable FP badge** — fingerprint injected into the body of each expanded finding so it can be selected and copied (header has `user-select:none`).
3. **Fix / Dismiss action bar** — each expanded finding now has a `/fix FP-xxx` copy button and a `/dismiss` button that reveals a dropdown + text field to compose and copy the full dismiss command.

Two outstanding issues to resolve:
- **UX bug**: clicking `/fix` while the Dismiss form is open leaves the form visible — it should close.
- **Not in template**: the changes were applied only to the existing HTML file. Future `/code-review` runs will regenerate the HTML without these features because the generator instructions (`output-format.md`) do not include them.

---

## Files to Change

### 1. UX bug fix — existing HTML
**File:** `CodeReviews/code-review-2026-07-16.html`

In the Fix button click handler (inside `<script>`), add one line before `copyToClipboard(...)`:

```diff
  fixBtn.addEventListener('click', function(e) {
    e.stopPropagation();
+   form.classList.remove('visible');   // close dismiss form if open
    copyToClipboard('/fix ' + fpText, fixBtn);
  });
```

---

### 2. Template instructions
**File:** `C:/Users/rawatv/.claude/plugins/KirklandAndEllis-marketplace/plugins/ai-assisted-development/skills/code-review/references/output-format.md`

The HTML report is LLM-generated on every `/code-review` run. The generator reads `output-format.md` for HTML structure requirements. Append a new section so all future generated reports include these features automatically.

#### Section to append: `### 3c. HTML Report — Required Interactive Features`

**CSS** (add inside `<style>`):
```css
/* Action bar */
.action-bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:14px; padding-top:12px; border-top:1px solid var(--border); }
.btn-fix { background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; border-radius:5px; padding:5px 14px; font-size:12px; font-weight:600; cursor:pointer; font-family:monospace; }
.btn-fix:hover { background:#c8e6c9; }
.btn-dismiss { background:#fff3e0; color:#e65100; border:1px solid #ffcc80; border-radius:5px; padding:5px 14px; font-size:12px; font-weight:600; cursor:pointer; font-family:monospace; }
.btn-dismiss:hover { background:#ffe0b2; }
.btn-copy-cmd { background:#1a237e; color:white; border:none; border-radius:5px; padding:5px 14px; font-size:12px; font-weight:600; cursor:pointer; }
.btn-copy-cmd:hover { background:#283593; }
.btn-copied { background:#2e7d32 !important; }
.dismiss-form { display:none; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; width:100%; }
.dismiss-form.visible { display:flex; }
.dismiss-select { font-size:12px; padding:4px 8px; border:1px solid var(--border); border-radius:4px; background:white; }
.dismiss-reason { font-size:12px; padding:4px 8px; border:1px solid var(--border); border-radius:4px; flex:1; min-width:200px; }
```

**JavaScript** (add before `</body>`). Important: `.finding` divs must NOT carry `onclick` — the script below handles expand/collapse via header listener only.

```js
// Header-only expand/collapse
document.querySelectorAll('.finding-header').forEach(function(header) {
  header.addEventListener('click', function() {
    header.closest('.finding').classList.toggle('open');
  });
});

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('btn-copied');
    setTimeout(function() { btn.textContent = orig; btn.classList.remove('btn-copied'); }, 1800);
  });
}

// Per-finding: copyable FP badge + Fix/Dismiss action bar
document.querySelectorAll('.finding').forEach(function(finding) {
  var fpEl = finding.querySelector('.finding-header .fp');
  var body = finding.querySelector('.finding-body');
  if (!fpEl || !body) return;
  var fpText = fpEl.textContent.trim();

  // Copyable FP badge at top of body
  var badge = document.createElement('div');
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-bottom:12px;font-family:monospace;font-size:12px;color:#546e7a;background:#eceff1;padding:3px 10px;border-radius:4px;cursor:pointer;user-select:text;';
  badge.title = 'Click to copy fingerprint';
  badge.innerHTML = fpText + ' <span style="font-size:10px;opacity:.6;">&#128203;</span>';
  badge.addEventListener('click', function(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(fpText).then(function() {
      badge.innerHTML = 'Copied! <span style="font-size:10px;">&#10003;</span>';
      setTimeout(function() { badge.innerHTML = fpText + ' <span style="font-size:10px;opacity:.6;">&#128203;</span>'; }, 1500);
    });
  });
  body.insertBefore(badge, body.firstChild);

  // Action bar at bottom
  var bar = document.createElement('div');
  bar.className = 'action-bar';

  var fixBtn = document.createElement('button');
  fixBtn.className = 'btn-fix';
  fixBtn.textContent = '\u26a1 /fix ' + fpText;
  fixBtn.title = 'Copy /fix command to clipboard';

  var dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn-dismiss';
  dismissBtn.textContent = '\ud83d\udeab /dismiss ' + fpText;
  dismissBtn.title = 'Build and copy /dismiss command';

  var form = document.createElement('div');
  form.className = 'dismiss-form';

  var select = document.createElement('select');
  select.className = 'dismiss-select';
  ['-- disposition --', 'false-positive', 'wont-fix', 'accepted-risk', 'by-design'].forEach(function(v, i) {
    var opt = document.createElement('option');
    opt.value = i === 0 ? '' : v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  var reasonInput = document.createElement('input');
  reasonInput.className = 'dismiss-reason';
  reasonInput.type = 'text';
  reasonInput.placeholder = 'Enter reason...';

  var copyCmd = document.createElement('button');
  copyCmd.className = 'btn-copy-cmd';
  copyCmd.textContent = 'Copy command';
  copyCmd.addEventListener('click', function(e) {
    e.stopPropagation();
    var disp = select.value;
    var reason = reasonInput.value.trim();
    if (!disp) { select.style.borderColor = '#c62828'; return; }
    if (!reason) { reasonInput.style.borderColor = '#c62828'; return; }
    select.style.borderColor = '';
    reasonInput.style.borderColor = '';
    copyToClipboard('/dismiss ' + fpText + ' ' + disp + ' "' + reason + '"', copyCmd);
  });

  fixBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    form.classList.remove('visible');   // close dismiss form if open
    copyToClipboard('/fix ' + fpText, fixBtn);
  });

  dismissBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    form.classList.toggle('visible');
  });

  form.appendChild(select);
  form.appendChild(reasonInput);
  form.appendChild(copyCmd);
  bar.appendChild(fixBtn);
  bar.appendChild(dismissBtn);
  bar.appendChild(form);
  body.appendChild(bar);
});
```

---

## Execution Steps

1. **Fix UX bug** in `CodeReviews/code-review-2026-07-16.html` — one-line insert in the Fix button handler.
2. **Append section `### 3c`** to `output-format.md` — CSS block + JS block as specified above.

---

## Verification

- Open `CodeReviews/code-review-2026-07-16.html` in a browser.
- Expand a finding → click `/dismiss` to open the form → click `/fix` → confirm the dismiss form closes and "✓ Copied!" appears on the fix button.
- On the next `/code-review` run, confirm the generated HTML includes the action bar, FP badge, and header-only toggle without any manual editing.
