---
name: articulate-as-human
description: Humanize text in two modes. File mode deterministically scans generated documents (Claude Code output, Markdown, HTML, plain text) for generic "AI-sounding" writing patterns — stock vocabulary (delve, seamless, robust, testament to, game-changer), promotional puffery, boilerplate transitions and conclusions, hedge-word clusters, vague/weasel attribution ("some critics argue", "industry reports suggest"), leftover chatbot artifacts ("I hope this helps"), the "not just X, it's Y" negation construction, dangling "-ing" significance clauses, bold-lead-in bullet lists, em-dash overuse, uniform sentence rhythm, and repeated paragraph openers. Trigger whenever the user asks to check, review, or clean up whether generated writing "sounds human"/"sounds like AI" or asks for a tone/voice pass. Direct-text mode rewrites provided text and returns it in chat/console without creating files or reports. File mode must always run scripts/check-tone.cjs first and report structurally before touching text — never silently rewrite.
---

# ArticulateAsHuman

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

Catches the *mechanical, checkable* signs of generic AI writing. It does not
judge whether the content is good, true, or well-argued — that's a separate
concern. This skill is a filter for one specific failure mode: prose that
reads like it could have been sent to anyone, about anything.

## Mode selection (always first)

Resolve mode in this order:

1. `--text <text>` => **text mode**.
2. `--file <path>` => **file mode**.
3. No override:
   - existing file or directory path => **file mode**
   - non-path argument => **text mode**

---

## Text mode workflow

When in text mode, rewrite/humanize the provided text directly and return the result in
chat/console.

Rules:

1. **Return only the humanized text by default.**
2. **Preserve meaning and factual detail**: facts, names, numbers, citations, and required
   structure stay intact.
3. **Avoid generic AI/corporate phrasing**: remove stock, vague, promotional phrasing and make
   wording specific to the content.
4. **Do not create files or reports** in text mode.

---

## File mode workflow (always in this order)

1. **Run the script first.** Never eyeball the document and guess — the
   whole point is deterministic, repeatable checks with file:line locations,
   the same way deterministic structural checks work elsewhere in this
   environment. Pattern coverage is drawn in part from Wikipedia's
   [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
   guide (maintained by WikiProject AI Cleanup) — stock vocabulary, phantom
   "some critics argue" attribution, the "not just X, it's Y" negation
   construction, dangling "-ing" significance clauses, and bold-lead-in
   bullet lists are all sourced from there rather than invented ad hoc.

   ```bash
   node "$PLUGIN_DIR/scripts/check-tone.cjs" <path-to-file-or-dir> [--json report.json]
   ```

   Works on `.md`, `.txt`, `.html` — pure Node.js built-ins (`fs`, `path`),
   no npm dependencies, so it runs fine under restricted egress and with
   nothing installed beyond Node itself.

2. **Report before rewriting.** Present the findings grouped by tier
   (tier1 vocabulary hits, hedges, weasel attribution, negation
   construction, tailing "-ing" clauses, bold-bullet lists, transition
   density, em-dash density, uniform rhythm, repeated openers), each with
   its file:line location.
   Do **not** rewrite anything at this stage, even if the fix looks obvious.
   The person decides what's worth touching — some flagged words may be
   intentional or contractually required phrasing (e.g. in a legal
   deliverable, "leverage" might be fine; the script doesn't know context).

3. **Add one qualitative pass on top of the script**, since regex can't
   catch everything. Read `references/qualitative-review.md` and apply it —
   it covers staging/inflation without a watched phrase, mechanical
   three-part structure, uniform formatting spread across non-consecutive
   lines, drafting leftovers, and absence of voice (flagged as an
   observation, not automatically a defect, since many formal deliverables are
   supposed to stay neutral). Note these as additional findings in the same
   report, clearly marked as judgment calls rather than script output, and
   only when a few of them co-occur in the same passage — a single isolated
   instance usually isn't worth flagging on its own.

4. **Only rewrite on request**, and only the specific flagged spans —
   never a full silent rewrite of the document. When asked to fix
   something:
   - Preserve every fact, name, number, citation, and structural element
     (headers, tables, the six-value status taxonomy, etc. — whatever
     structural contract the source document already follows).
   - Replace the flagged phrase/pattern with something specific to that
     sentence's actual content, not a different generic synonym
     (swapping "leverage" for "utilize" doesn't fix anything).
   - Show a before/after diff for each change so it's auditable, not a
     silent overwrite.

## What this skill is not

- Not a voice-matching tool. It doesn't try to make text sound like a
  specific person — it only flags patterns that read as generically
  AI-generated to any reader. (If voice-matching against a writing sample
  is ever wanted, that's a different tool — don't conflate the two.)
- Not a grammar or style linter. Skip anything about comma placement,
  passive voice as a grammatical category, etc. — that's a different job.
- Not a guarantee against AI-detectors. No rewrite promises "undetectable"
  output; the goal is prose a human reader wouldn't flag as generic, not
  evading a classifier.
- Not a license to add personality where the document format doesn't call
  for it. `references/qualitative-review.md`'s "absence of voice" category
  is deliberately the softest one in the guide — flag it, don't fix it
  automatically.

## Extending the pattern lists

`$PLUGIN_DIR/scripts/check-tone.cjs` has several tunable lists near the top:
`TIER1_PHRASES`, `TRANSITION_WORDS`, `HEDGES`, `WEASEL_ATTRIBUTIONS`,
`TAILING_CLAUSE_MARKERS`, plus two density thresholds
(`TRANSITION_DENSITY_THRESHOLD`, `EM_DASH_DENSITY_THRESHOLD`). If an
organization-specific phrase keeps showing up in generated drafts (e.g.
something a particular skill tends to overuse), add it
to `TIER1_PHRASES` rather than handling it as a one-off — that keeps the
check reusable across future documents instead of re-noticing the same
pattern by hand each time.
