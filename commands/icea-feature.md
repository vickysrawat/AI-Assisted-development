---
description: Explicitly invoke the ICEA feature planning gate for a work item. Use when the auto-trigger did not fire, when you want to re-generate an ICEA for an existing item, or when starting feature planning deliberately. The ICEA gate also triggers automatically on feature-description keywords — this command is the explicit invocation path.
argument-hint: ADO-<id>  Release-<id>  Sprint-<id>   e.g.  ADO-1847 R3 S12   (any missing identifiers will be requested)
---

## Model routing

This command uses the **generation tier** — `ICEA_MODEL`
(default: `claude-opus-4-6`).

To override: `{{ "env": {{ "ICEA_MODEL": "claude-opus-4-7" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /icea-feature — Explicit ICEA gate invocation

Forces the ICEA feature planning gate regardless of whether trigger keywords were detected.
Use this when:
- The auto-trigger did not fire for a feature request
- You want to re-generate or revise an existing ICEA
- You are starting deliberate feature planning from scratch

---

## Step 1 — Load the skill

```
Read skills/icea-feature/SKILL.md and execute it.
```

Pass any arguments directly:
- If an ADO ID was provided (e.g. `ADO-1847`), use it as the work item ID
- If a Release number was provided (e.g. `R3` or `Release3`), capture it as RELEASE_ID
- If a Sprint number was provided (e.g. `S12` or `Sprint12`), capture it as SPRINT_ID
- If a feature description was provided inline, treat it as the initial feature request
- If any of the three identifiers (ADO #, Release #, Sprint #) are missing:
  invoke the ICEA gate in blank-slate mode and prompt for **all missing identifiers
  in a single question** before proceeding

---

## Hard Rules

- This command bypasses auto-trigger detection but NOT the ICEA gate itself
- The developer must still explicitly approve the ICEA before any code is generated
- ADO #, Release #, and Sprint # are ALL required — do not draft the ICEA until all three are known
- Use `/skip-icea` prefix only in genuine emergencies — it is logged
