---
description: Answers codebase questions primarily from architecture docs and domain-map. Will optionally read ONE source file with explicit consent (Category B) when structural docs don't contain the answer. Saves hundreds of tokens vs scanning src/. Tells you exactly which file to look at for deeper detail.
argument-hint: "<question about the codebase>"
---

## Model routing

This command uses the **infrastructure tier** — `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

To override: `{{ "env": {{ "INFRA_MODEL": "claude-opus-4-6" }} }}` in `.claude/settings.json`.
See `skills/shared/model-routing-spec.md` for the full specification.

---

# /explain — Codebase Q&A without source scanning

Answers structural questions about the codebase using only `.claude/architecture/`
docs. No source scanning. Instant, low-cost answers for "how does X work" and
"where is Y handled" questions.

If the architecture docs don't contain enough to answer fully, the command tells
you exactly which one file to look at — and only that file.

---

## Step 1 — Parse the question

Extract the question from the invocation arguments.

If no question was provided:
```
Ask a question about the codebase:
  /explain "How does Azure AD auth flow through the API layer?"
  /explain "Where are matter filters applied?"
  /explain "What pattern do we use for error handling?"
```

---

## Step 2 — Load architecture context (always, never skip)

```bash
cat .claude/architecture/architecture.md 2>/dev/null || echo "NO_ARCH_DOCS"
cat .claude/architecture/domain-map.md 2>/dev/null || echo "NO_DOMAIN_MAP"
```

Also load any additional architecture files present:
```bash
ls .claude/architecture/*.md 2>/dev/null
```
Read each one found (they are small).

If `NO_ARCH_DOCS` and `NO_DOMAIN_MAP`:
```
⚠ No architecture docs found.
Run /dream-init to generate them — /explain relies on these to answer without scanning source.
```
And stop.

---

## Step 3 — Answer from architecture docs

Attempt to answer the question using only the architecture context loaded in Step 2.

**Answer format:**

```
{Direct answer to the question — 2–5 sentences.
 Reference layer names, patterns, and file names from the architecture docs.
 Do not invent details not present in the docs.}

Relevant area: {AreaName from domain-map}
Entry point  : {path/to/EntryFile.cs from domain-map}
Key files    : {list from domain-map, if relevant}
```

---

## Step 4 — Decide whether source is needed

After answering from architecture docs, assess confidence:

**HIGH confidence** (answer is complete from docs):
- State the answer
- List the relevant files from the domain-map for reference
- Do not open any source files

**MEDIUM confidence** (partial answer, one file would clarify):
- State what is known from the docs
- Identify the ONE file most likely to contain the missing detail
- Ask:
  ```
  The architecture docs give a partial answer. To be precise,
  I'd need to read: {file}
  Shall I read it? (yes / no)
  ```
- Only read that file if the developer confirms

**LOW confidence** (question is too specific for architecture docs):
- State what is known
- Name the 1–2 most relevant files from the domain-map
- Say:
  ```
  This is too specific for the architecture docs.
  The most likely place to look: {file}
  Run /explain after reading it yourself, or say "yes" and I'll read {file}.
  ```

---

## Step 5 — If developer says yes to reading a file

Read exactly ONE file. Answer the question from its content.

```
{Precise answer now that the source has been read}

Source: {file}:{line range if applicable}
```

Do not read additional files unless the developer explicitly asks.

---

## Hard Rules

This command follows `skills/shared/source-file-consent.md` Category B.
The gate in Step 4 is the implementation of that spec.

- NEVER scan `src/` or any directory without an explicit developer confirmation in Step 4
- NEVER read more than ONE source file per /explain invocation
- NEVER say "I don't have access to the source code" — the architecture docs were built
  from the source and contain the structural answer for most questions
- If the architecture docs are stale (fingerprint mismatch), note it:
  ```
  ⚠ domain-map.md may be stale — run /update-arch for a fresh answer
  ```
  Then answer with what is available
