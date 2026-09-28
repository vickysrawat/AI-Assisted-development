# Code Review Skill — Output Format
_Load in Step 0e before beginning analysis._

---

## 3. Output Format

### 3a. Single Finding Block
```
CID <id> | <CHECKER_NAME> | <Impact: Critical/High/Medium/Low>
File: <path>
Function: <class.method()>
Impact: <one sentence — what can go wrong>

Event Path:
  Event 1 [<role>]  <file>:<line>  — <what happens here>
  Event 2 [<role>]  <file>:<line>  — <what happens here>
  Event 3 [<role>]  <file>:<line>  — <what happens here / the defect>

Vulnerable Code:
  <the actual problematic code snippet, with file:line>

Fix:
  <corrected code snippet — complete enough to copy-paste, with a one-line
   explanation of what changed and why>

References: <CWE / OWASP / MSRC link if applicable>
```

**Every finding MUST include both a "Vulnerable Code" snippet showing the current
problematic code, and a "Fix" snippet showing the corrected code.** Never give a
fix as prose only — always provide the actual corrected code the developer can paste in.

Roles: `Source` | `Transfer` | `Sink` | `Check` | `Null` | `Alloc` | `Free` | `Lock` | `Unlock` | `Defect`

### 3b. Summary Table (end of report)
```
## Defect Summary

| CID  | Checker          | Impact   | File              | Function         | Status |
|------|------------------|----------|-------------------|------------------|--------|
| 1001 | TAINTED_SQL      | High     | UserRepo.cs:87    | Find()           | New    |
| 1002 | NULL_RETURNS     | Medium   | OrderSvc.cs:43    | GetById()        | New    |
| ...  |                  |          |                   |                  |        |

Total: N findings — N Critical, N High, N Medium, N Low
Defect density: N per 1,000 lines (estimated)
```

---

### 3c. HTML Report — Required Interactive Features

Every generated HTML report MUST include the following CSS and JavaScript. These are
mandatory — do not omit or simplify them. They are injected at generation time, not
patched after the fact.

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

**JavaScript** (add before `</body>`).
Important: `.finding` divs must NOT carry an `onclick` attribute — expand/collapse
is handled by the header listener only (clicking the body must not collapse the card).

```js
// Header-only expand/collapse — clicking inside the body does NOT collapse the card
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

// Per-finding: inject a copyable FP badge at the top of the body + Fix/Dismiss action bar at the bottom
document.querySelectorAll('.finding').forEach(function(finding) {
  var fpEl = finding.querySelector('.finding-header .fp');
  var body = finding.querySelector('.finding-body');
  if (!fpEl || !body) return;
  var fpText = fpEl.textContent.trim();

  // Copyable FP badge — selectable text, click copies to clipboard
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

  // Action bar — Fix button + Dismiss button with inline form
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

  // Fix button: copies command AND closes dismiss form if it was open
  fixBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    form.classList.remove('visible');   // close dismiss form if open
    copyToClipboard('/fix ' + fpText, fixBtn);
  });

  // Dismiss button: toggles the inline form
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
