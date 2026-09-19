# 0069 — Release metrics skill: dual output, Mermaid + Chart.js, and lessons learned synthesis
Status: Accepted · Date: 2026-09-18
Governs: `skills/release-metrics/SKILL.md`, `skills/icea-implement/SKILL.md`, `CLAUDE.md §0a`
Relates to: [[0068-end-to-end-audit-trail-and-rich-tracker]], [[0034-interactive-draft-save-flow]],
[[0023-model-routing]], [[0007-memory-audit-loop]]

## Problem

ADR 0068 established a structured `ai-audit.md` event log and a rich `tracker.md`
implementation journal per ADO. The data now exists. The gap is that nothing reads it.

There is no mechanism to answer:
- Is ICEA quality improving across releases? (revision counts trending down?)
- Which phase consumes the most rework? (planning vs code vs build)
- What recurring issues keep appearing across stories?
- How many tokens did this release spend, and in which phase?
- What should the team do differently next sprint?

The data is spread across dozens of individual `ai-audit.md` and `tracker.md` files with no
aggregation layer, no trend view, and no cross-story synthesis.

## Decision

**A `release-metrics` skill** aggregates all ADO artefacts in a release and produces two
output files in one run:

### Output 1 — Markdown with Mermaid (`release-metrics-R{N}-{date}.md`)

Text-based, lives in the repo, renders in VS Code preview, ADO wikis, and GitHub.
Exportable to PPT via Marp or Pandoc without format conversion. Contains 8 diagram types
using native Mermaid syntax: `xychart-beta` (bars + lines), `pie`, `quadrantChart`,
`gantt`, `mindmap`.

### Output 2 — Self-contained HTML with Chart.js (`release-metrics-R{N}-{date}.html`)

Shareable as a file attachment — email, Teams, SharePoint. Chart.js 4.x vendored inline
(downloaded once via `vendor/fetch-vendor.js`). No internet required to open. Contains
chart types Mermaid cannot express: stacked bar (revision by phase per ADO), radar
(quality dimensions), scatter (ICEA revisions vs follow-ups), stacked area (token trends),
and Pareto with dual Y-axis. Five-tab interface: Summary / Per-Story / Trends / Lessons /
Tokens.

### Per-story lessons learned (generated at story-complete)

`icea-implement` Step 6 generates a `### Lessons learned` section in the tracker
immediately after populating Delivered/Tests/Design decisions/Known gaps. The section:
- Counts revision events from the audit trail grouped by phase
- Reads Summary column text from revision rows to identify themes
- Only generates lessons for phases with ≥ 2 revision events or ≥ 2 follow-ups (single
  events are noise, not patterns)
- Produces a revision summary table, a root-cause analysis paragraph, and specific
  actionable "next time" checklist items

The `LESSONS ADO-{ID}` keyword re-generates this section on demand for any ADO.

### ISO 8601 timestamps in audit trail

All audit row Date cells are upgraded from `YYYY-MM-DD` to `YYYY-MM-DDTHH:MM:SS`.
This enables phase duration calculation and session JSONL token windowing (sum input +
output tokens from turns whose timestamps fall within a phase's start-to-end window).

### Keyword handlers

Five new handlers in CLAUDE.md §0a:
- `METRICS RELEASE-{N}` — full release report
- `METRICS RELEASE-{N} SPRINT-{S}` — sprint-scoped
- `METRICS RELEASE-{N} VS RELEASE-{M}` — explicit trend comparison
- `LESSONS RELEASE-{N}` — alias for METRICS (lessons tab is primary focus)
- `LESSONS ADO-{ID}` — single-story lessons re-generation

## Rationale

- **Dual output because two audiences.** The Markdown file is the repo artefact — version
  controlled, diff-able, goes into wikis and presentations via text tools. The HTML file is
  the sharing artefact — one file, no dependencies, opens in any browser. Neither serves
  the other's purpose; both are needed.
- **Mermaid and Chart.js are complementary, not competing.** Mermaid covers portability
  (text-based, renders everywhere Markdown renders). Chart.js covers expressiveness (stacked
  bars, radar, true scatter, dual Y-axis Pareto) that Mermaid's `xychart-beta` cannot yet
  produce. The skill generates both from the same data model in one pass.
- **Vendored Chart.js for offline HTML.** A CDN link would break the "shareable without
  internet" requirement. Vendoring (one `node fetch-vendor.js` call per machine) keeps
  the plugin lightweight while ensuring offline capability.
- **Per-story lessons at story-complete, not release-time.** Generating lessons immediately
  after implementation keeps context fresh — the revision Summary column text is just parsed,
  not recalled from memory. Release-time synthesis then aggregates these pre-computed
  per-story lessons; it does not re-derive them.
- **Threshold rule for lessons (≥ 2 events).** A single revision round is often a
  misunderstanding or a typo, not a repeatable pattern. The ≥ 2 threshold prevents
  generating noise lessons from one-off corrections while capturing genuine recurring gaps.
- **Score formula (10 − metric, bounded at 0).** Radar chart needs comparable axes.
  Inverting the count-based metrics (lower = better) onto a 10-point scale (higher = better)
  makes the radar read intuitively — a larger polygon = a better release. The formula is
  deterministic, not a model judgement.

## Alternatives rejected

- **Single HTML output only.** Rejected — HTML is not diff-able, not searchable with grep,
  not pasteable into an ADO wiki comment, and not portable to PPT without a screenshot.
  The Markdown file serves all of these without any tool dependency.
- **Single Markdown output only.** Rejected — Mermaid cannot produce stacked bars, radar
  charts, or a Pareto with dual Y-axis. The stakeholder-sharing use case needs richer charts
  than Mermaid's `xychart-beta` currently supports.
- **Use a CDN link for Chart.js.** Rejected — the HTML report is designed to be emailed or
  shared via Teams. Recipients may open it offline, on a corporate network that blocks CDNs,
  or on a device without internet access. Inline vendoring removes all three failure modes.
- **Generate lessons at release-time only.** Rejected — by release-time, the specific
  revision themes recorded in the Summary column are available on disk but the implementation
  context is cold. Generating lessons at story-complete while the skill can see both the audit
  trail and the just-written code produces more specific, accurate "next time" items.
- **Use the existing `sprint-metrics` skill.** Rejected — `sprint-metrics` measures ADO
  process compliance (ICEA rate, PR rejection rate, rework hours from Azure DevOps). The
  release-metrics skill measures AI-session quality from the plugin's own artefacts. The
  data sources are disjoint; combining them would mix unrelated concerns.

## Consequences

- `release-metrics/` directory is created at the repo root on first run. It should be
  committed (metrics are release artefacts) or added to `.gitignore` if treated as generated
  output — the team decides.
- `vendor/chart.min.js` (~220 KB) must be downloaded once per developer machine. It is
  not committed to the plugin repo (gitignored) to avoid bloating the plugin bundle.
- Token estimation requires ISO timestamps (added in this ADR) AND session JSONL files in
  `~/.claude/projects/`. If either is absent, the Tokens tab is omitted with a clear note.
- Trend charts require at least one previous release report on disk. From the first release
  onward they appear automatically; the first release report omits the Trends tab.
- The per-story lessons section adds ~30–60 tokens of context processing at story-complete.
  This is negligible against the cost of a full story implementation.

## Revisit when

- If Mermaid adds native stacked-bar support, consolidate the bar charts to Mermaid and
  simplify the Chart.js output to only the truly Mermaid-incompatible types.
- If the ≥ 2 threshold produces too many or too few lessons in practice, adjust — the
  threshold is a parameter in the skill instruction, not a hard-coded constant.
- If `~/.claude/projects/` JSONL format changes across Claude Code versions, update the
  token-windowing logic in Step 3e.
