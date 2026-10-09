# WebSearch Gate

**Scope:** business-context regulatory grounding only (`SET DOMAIN` / `REFRESH DOMAIN` Step 3).
Migration, security, upgrade, and knowledge-freshness skills are NOT subject to this gate —
they search without prompting; that is expected and correct behaviour.

Reads `websearch` from `.claude/dream-init-state.json`. Default is `"off"` when the field is absent.

---

## Read the setting

```bash
WS=$(node -e "
try {
  const s=JSON.parse(require('fs').readFileSync('.claude/dream-init-state.json','utf8'));
  process.stdout.write(s.websearch||'off');
} catch(_) { process.stdout.write('off'); }
" 2>/dev/null)
```

---

## If `WS = "on"` — proceed without prompt.

---

## If `WS = "off"` — prompt before searching

State the specific reason for this search (not "gathering data" — be concrete about what
fact is needed and why WebSearch is required to get it):

```
🌐 WEB SEARCH — {one-line concrete reason, e.g. "verify current LTS version of Node.js 20"}

   Web search is currently off. Allow this search?
     A) Yes — allow this search and proceed
     B) Yes, allow all searches this session — skip this prompt for the rest of the session
     C) No — skip this search; continue without web results

   Reply A, B, or C.
```

**On A** — run the search. `websearch` stays `"off"` for future calls this session.

**On B** — run the search. Treat `websearch` as `"on"` for the remainder of this session.
Do NOT write this override to `dream-init-state.json` — it is session-scoped only.

**On C** — skip the search entirely. Append to skill output:
> _(web search skipped — results based on training data / offline refs only)_

Continue with the offline fallback if one exists; otherwise proceed without that data.

---

## Hard rules

- This gate applies ONLY to business-context regulatory grounding — migration, security, upgrade, and knowledge-freshness skills search without prompting
- NEVER persist a session-B override to `dream-init-state.json`
- ALWAYS state the specific, concrete reason in the prompt — vague descriptions are not acceptable
- `websearch` absent from `dream-init-state.json` = `"off"` — never default to `"on"` for business-context grounding
