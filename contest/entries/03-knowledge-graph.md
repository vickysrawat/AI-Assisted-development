# Entry 3 — Codebase Knowledge Graph

> The one where the map of your codebase is drawn by a script that reads your imports, not guessed by
> an AI that would happily make half of it up.
> Category: Resourcefulness · Status: READY
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 3.
>
> A quick note so this doesn't blur into Entry 4: **this** entry is about the graph as a *thing that
> gets built*, how it's made and why you can trust it. Entry 4 is about what that same graph *saves*
> you. Same artifact, two stories.

---

## 1. The pitch, in one breath

Ask an AI "what depends on the Auth module?" and it'll answer confidently, and invent half the
answer. This is a real map of your codebase where the actual dependencies are *parsed from your source
by a script*, the AI's guesses are clearly labeled as guesses, and the whole thing stays current
without anyone re-reading the repo.

## 2. Why it exists

Understanding how a codebase actually fits together is expensive and slow: you read, and read, and
read. So the tempting shortcut is to just ask the model. And the model will cheerfully tell you… a
mix of truth and fiction, delivered with identical confidence.

That's the trap that makes this worth building: **a hallucinated dependency is worse than a missing
one.** A missing edge, you notice. A confident wrong edge sends your refactor straight into a wall.
What you actually need is a structural map that's both cheap to keep current *and* trustworthy, and
those two usually pull in opposite directions.

This is for anyone doing real structural work (refactors, impact analysis, migrations) who can't
afford either the cost of re-reading everything or the risk of invented dependencies.

## 3. What actually works today

At the center is `graph.json`, the real, committed structure of your codebase: typed modules (this is
a service, that's a datastore, that one's a UI) and typed, directed dependencies between them. The
human-readable markdown you browse is *generated from* that JSON, never maintained by hand, so the two
can never drift apart and quietly disagree.

Every dependency edge is stamped with where it came from: `EXTRACTED` (a script found it in your
source), `INFERRED` (the model reasoned it out), or `AMBIGUOUS` (flagged for a human). It stays fresh
through `/graph-sync`, which regenerates only the modules that actually changed, and you can literally
look at it with `/graph-viz`, an offline 2D (or 3D) map you can hover and explore.

## 4. Who does what (the AI, the script, and you)

- **The AI** classifies module types and writes only the edges a parser *can't* see (dependency
  injection, dynamic wiring) and always labels those as inferred.
- **The script** (`graph-extract-edges.js`, ADR 0041) owns every real dependency: it parses your
  imports offline, so your raw source never even enters the model's context. No source, no
  hallucination.
- **You** review the graph in a pull request like any other code, and resolve the `AMBIGUOUS` ones.

## 5. How it stays true

1. The architect builds it once; it's committed and reviewed like source.
2. You change code; a git hook notices the drift and flags the affected modules.
3. `/graph-sync` re-hashes each module and regenerates *only* what changed, re-deriving the real edges
   from source with the script, and a validator checks there are no orphans, no dangling edges, and no
   drift between the JSON and its markdown before any of it is trusted.

## 6. What it's worth (told straight, labeled straight)

The claim I'm proudest of is the one that's easiest to verify: **no hallucinated dependencies.** Real
edges come from a script (ADR 0041); the model's guesses are labeled and never treated as fact. That's
**measured**: the script and the ADR exist, and you can read both (`../measured-claims.md` §4).

Its integrity is machine-checked too (no orphans, no dangling edges, no JSON-vs-markdown drift) as
part of the plugin's 300-passing-checks suite. And it's genuinely frugal: it regenerates only what
changed, and it doesn't even *store* reverse edges; it derives "what depends on X" on the fly. *(measured.)*

Whether it makes onboarding or refactoring measurably faster: that I believe but haven't measured, so
it stays **not-yet-evaluated**.

## 7. Why it sticks with you

Hover a hub node in the offline 3D map and its whole neighborhood lights up at once: dependents on one
side, dependencies on the other, structure you can see instead of infer. Then the line underneath does
the quieter work: these edges aren't guessed, a script read your imports. That second claim is the one
that survives a refactor built on top of it, which is exactly where a confidently-wrong AI answer costs
you.

## 8. The responsible-AI part

- Trust is built into the *data*: provenance labels keep parser-fact and model-guess visibly separate,
  and impact analysis is forbidden from treating a guess as a dependency.
- It's human-reviewable; the graph is committed and goes through PR review like any other artifact.
- **Where your data goes:** the edge extractor parses imports *offline*; your raw source never enters
  the model's context; nothing leaves the environment except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** the inferred edges are heuristics, not gospel; module-type guesses get better
  over successive syncs; cycles are reported, not auto-resolved.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 3 (2 minutes). The shape: `/graph-viz` → open the map, hover
a hub, watch dependencies and dependents appear → say the line ("script-extracted from your imports,
not guessed") → edit a file, watch the hook mark it stale → `/graph-sync` regenerates just that module
→ flip to the 3D view, fully offline. **Backup:** a pre-rendered `graph.html` in 2D and 3D.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** Trustworthy structure and impact analysis; the speed payoff is labeled not-yet-evaluated.
- **Working solution & use of AI — 5.** Script-fact and model-inference cleanly separated by provenance.
- **Resourcefulness — 5.** Offline scripts and file hashes; regenerate only the delta; dependents derived, not stored.
- **Creativity & fun — 4.** Provenance-labeled edges and an offline 2D/3D map you can actually explore.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup — and held firmly on the artifact story.
- **Responsible AI — 5.** No hallucinated deps by construction; offline parse; machine-validated integrity.

Nothing below a 4 → **READY.**
