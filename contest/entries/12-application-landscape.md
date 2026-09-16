# Entry 12 — The Application Landscape (multi-root scan & blast radius)

> The one where your repo finally stops working blind: it can see what the *other* repos offer, and
> whether the change you're about to make will quietly break one of them.
> Category: Practical value + Resourcefulness · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 12.
>
> A quick boundary so this doesn't blur into Entry 3: that entry is the knowledge graph of *one* repo.
> This one is about making that graph (and every scan) reach *across* repos, so the AI understands
> the whole application, not just the folder you happen to be sitting in.

---

## 1. The pitch, in one breath

Real applications aren't one repo. They're a UI repo, an API repo, a handful of services, and when
you're working in one, your AI has no idea what the others expose or expect. This wires the dependent
repos into view, so the AI understands the whole landscape and can tell you when a change on your side
has a *blast radius* that reaches someone else's.

## 2. Why it exists

Here's the daily reality of multi-repo work: you're in the UI repo, and the API repo might as well be
on the moon. Your AI assistant reasons confidently about the code in front of it and is completely
blind to the contract it's actually calling. So you rename a field, ship it, and three days later the
API team asks why half their clients are throwing 400s.

The blindness isn't a model limitation; it's a *scoping* one. Every scanner that improvises `find .`
only ever sees the current repo, which is exactly what made the dependent repos silently invisible.
This exists for anyone working in a service that's really part of a bigger system, who needs their AI
to reason about the whole picture, and to warn them before a local change becomes someone else's
outage.

## 3. What actually works today

You wire your locally-cloned dependency repos into one list (`additionalDirectories`), and from then on
a single shared resolver decides "which repos do I scan?", so *every* skill sees the same landscape
instead of each one improvising.

Orientation skills (building the knowledge graph, `explain`, planning a feature) pull the dependency
repos in **by default**, because understanding is read-only and safe. The scanners that write findings
(security, code review, readiness) stay repo-only unless you explicitly say `--with-deps`. And the
graph itself spans repos: a module from another repo is tagged with where it came from, so
"what depends on this?" can now cross a repo boundary, which is exactly what a blast-radius question
needs.

## 4. Who does what (the AI, the resolver, and you)

- **The AI** reasons across the whole landscape (it can see the API the UI calls, the service the API
  depends on) and traces impact across those boundaries.
- **The resolver** (`multi-root-scan`) is the single source of truth for scan roots; it always puts
  your repo first, skips missing or nested paths, and **announces every dependency repo out loud**
  before touching it, never a silent cross-repo scan.
- **You** decide which repos are in scope, and you approve any *write* that would cross a repo boundary;
  even a blanket "approve all" won't silently let it write into another repo.

## 5. How a blast-radius check plays out

1. You wire the dependency repos in once (`additionalDirectories`).
2. The knowledge graph is built across all of them; dependency edges now cross repo lines.
3. You change something in your repo; because the graph spans the landscape, the AI can point at the
   modules in *other* repos that depend on what you touched.
4. If a fix genuinely needs to reach into a dependency repo, that write **stops for your explicit
   approval**; repo-boundary crossings are never waved through.

## 6. What it's worth (told straight, labeled straight)

The concrete value is that "which repos do I scan?" has **one honest answer**, shared by the graph
builder, `explain`, feature planning, security, code review, and readiness; no scanner is quietly
blind to the rest of the system anymore. And the graph carries cross-repo provenance, so impact
analysis stops at the *system* boundary, not the *folder* boundary. *(measured: the shared resolver
and its consumers exist; `../measured-claims.md`.)*

Two safety properties come free: dependency repos are pulled in for *reading* by default but never for
*writing findings* without your say-so, and no cross-repo write ever happens silently. *(measured:
read-default / write-confirm policy.)*

What I won't claim: a number for how many cross-repo breakages it's actually prevented. That's
**not-yet-evaluated**; it depends on real teams and real changes over time.

## 7. Why it sticks with you

The demo works on a fear anyone who's shipped a breaking API change already carries: change one field,
and watch the AI light up the *other* repo's modules that just became collateral damage. It's the moment
a single-repo assistant becomes a whole-system one, and "what else did I just break?" stops being dread
and becomes an answer on screen.


## 8. The responsible-AI part

- Nothing is scanned silently; every dependency repo is announced before it's read.
- Reading the landscape is safe-by-default; *writing* findings about it, or *editing* another repo,
  takes an explicit opt-in, and a cross-repo write always stops for approval (even under "approve all").
- Dependency repos are curated: only the manifest-referenced ones you actually wired in, not a wild
  crawl of your disk.
- **Where your data goes:** it reads local repos you explicitly listed; nothing leaves the environment
  except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; the multi-root scan reads
  `additionalDirectories` from Claude Code's own `settings.local.json`, so it won't run as-is on GitHub
  Copilot, Cursor, or another agent. The *idea* (one shared scan-root resolver spanning repos) ports;
  this *implementation* doesn't.
- **The honest caveat:** it sees the repos you *cloned and wired in*; a service you haven't pulled
  locally is still outside its view; it maps the landscape you gave it, not the whole org.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 12 (2 minutes). The shape: wire a dependency repo into
`additionalDirectories` → run `explain` or `/graph-viz` and watch it announce the dependency repo and
draw edges that cross the boundary → change a field in your repo → ask what it impacts, and watch it
name modules in the *other* repo. **Backup:** a pre-wired two-repo setup with a cross-repo graph rendered.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** Multi-repo blindness is a daily, expensive problem; this is the direct answer.
- **Working solution & use of AI — 4.** One shared resolver; the AI reasons across it; writes stay gated.
- **Resourcefulness — 5.** One resolver, reused by every scanner; the existing graph simply learns to span repos.
- **Creativity & fun — 4.** "Blast radius across repos" is a genuinely satisfying thing to watch light up.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup, held on the landscape lens vs Entry 3.
- **Responsible AI — 5.** Announced scans, read-default/write-confirm, no silent cross-repo writes.

Nothing below a 4 → **READY.**
