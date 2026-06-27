---
description: Generate memory/health.html — a self-contained browser dashboard showing confidence scores, decay curve, promote candidates, and dream run history with clickable justification panels.
argument-hint: (no arguments needed)
---
# /dream-health — Memory Health Dashboard

You are generating a **memory health report** for this project.
This command reads all memory files and produces a self-contained HTML dashboard at `memory/health.html`.

---

## Trigger

Runs when the user types `/ai-assisted-development:dream-health`.
Do not run as part of a regular `/dream` consolidation. It is a separate, read-only command.

---

## Step 1 — Read all memory files

Read ALL of the following in full:

1. `CLAUDE.md` — promoted entries
2. `memory/MEMORY.md` — rolling session log
3. All `memory/topic-*.md` files
4. `memory/dream-log.md` — full audit trail

**Do not modify any file.** This command is read-only.

---

## Step 1b — Resolve session URLs

After reading all files, collect every unique session ID mentioned across all files
(e.g. `session-001`, `session-012`). These appear in:
- Memory entry headers in MEMORY.md (`### [session-N]`)
- Operation rows in dream-log.md (`session-003`, `s-006`)
- Source references in topic-*.md files

For each unique session ID, use `conversation_search` to find the actual claude.ai
conversation URL. Search using project-specific keywords from that session's entries
combined with the session date if available.

Build a **session URL map**:
```
session-001 → https://claude.ai/chat/{uuid}  (found)
session-003 → https://claude.ai/chat/{uuid}  (found)
session-007 → null                            (not found — log as unresolved)
```

Rules for resolution:
- Search with 2–3 keywords from entries that originated in that session
- If multiple conversations match, pick the one whose `updated_at` is closest to the
  session date in the memory file
- If no match is found, mark as `unresolved` — do not invent a URL
- Do not search for more than 20 sessions in one run; if there are more, resolve the
  most recent 20 and mark older ones as `archive — not searched`

This map is used in Step 3 to render clickable links in the dream run history table
and in the per-entry operation trail.

---

## Step 2 — Compute metrics

Extract and calculate the following from what you read:

### Per-entry metrics
For every knowledge entry across all memory files, record:
- `id` — unique identifier (topic slug + index)
- `title` — short label for the entry
- `file` — which file it lives in
- `topic` — topic category
- `confidence` — current score (0.0–1.0)
- `session_origin` — which session first wrote it (e.g. session-003)
- `session_origin_url` — resolved URL from session map, or null if unresolved
- `last_seen` — most recent session that referenced it
- `last_seen_url` — resolved URL for last_seen session, or null
- `dream_cycles_old` — how many dream runs have passed since last reference
- `operation_history` — list of operations applied to it (ADD, UPDATE, PROMOTE, etc.)
- `conflicts` — boolean, whether this entry has a known conflict

### Aggregate metrics
- Total entries across all files
- Entries per topic file
- CLAUDE.md entry count (and % of recommended max of 20)
- Average confidence score
- Confidence distribution (count of entries in each band: 0–0.2, 0.2–0.4, 0.4–0.6, 0.6–0.8, 0.8–1.0)
- Entries at risk (confidence ≤ 0.3)
- Entries ready to promote (confidence ≥ 0.85, not yet in CLAUDE.md)
- MEMORY.md line count (flag if approaching 200)
- Dream run count (from dream-log.md)
- Sessions since last dream run
- Dream frequency (average sessions between runs)

### Decay curve data
From dream-log.md, extract the average confidence per dream run to show trend over time.

---

## Step 3 — Generate the HTML report

Write a complete self-contained HTML file to `memory/health.html`.

The file must:
- Use only inline CSS and vanilla JS — no external dependencies
- Work when opened directly in a browser (file:// protocol)
- Be fully self-contained (no CDN links, no fetch calls)
- Use the project color scheme: dark teal `#04342C`, mid teal `#1D9E75`, light teal `#E1F5EE`, amber `#EF9F27`, red `#E24B4A`

### Required sections in the report

**1. Header**
Project name, generation timestamp, sessions since last dream, dream run count.

**2. Health scorecard** (top row of cards)
Four KPI cards:
- Total entries (with trend vs last dream)
- Average confidence (color-coded: green ≥ 0.7, amber 0.5–0.69, red < 0.5)
- CLAUDE.md usage (N / 20 entries, progress bar)
- MEMORY.md size (N lines, warning if > 150, danger if > 180)

**3. Confidence distribution chart**
Horizontal bar chart showing count of entries in each confidence band.
Color each bar with the band color (red → amber → dark amber → teal → dark teal).
Show count and percentage labels on each bar.

**4. Decay curve**
Line chart showing average confidence per dream run over time.
X-axis: dream run number. Y-axis: 0.0–1.0.
Draw a horizontal dashed line at 0.5 (watch threshold) and 0.85 (promote threshold).
Use SVG — no canvas, no external charting library.

**5. Topic coverage table**
One row per topic file (+ CLAUDE.md + MEMORY.md):
| Topic | Entries | Avg Confidence | At Risk | Ready to Promote | Last Dream |
Color-code the Avg Confidence cell.

**6. Entries at risk**
Table of all entries with confidence ≤ 0.3.
Columns: Entry | Topic | Score | Sessions old | Recommended action
Recommended action: DELETE if score ≤ 0.2, REVIEW if 0.2–0.3.

**7. Promote candidates**
Table of entries with confidence ≥ 0.85 not yet in CLAUDE.md.
Columns: Entry | Topic | Score | Sessions confirmed | Why promote

**8. Dream run history**
Table of all dream runs from dream-log.md, most recent first.

Columns:
| Run # | Date | Sessions since prior | ADD | UPDATE | DELETE | PROMOTE | Avg confidence |

Each operation row in the table is **clickable**. Clicking an operation row opens a
**side panel** that slides in from the right showing the full justification block for
that operation, parsed from the dream-log.md `#### [OPERATION]` sections.

**Side panel structure:**
```
┌─────────────────────────────────────────────┐
│ [UPDATE] test runner                    ✕   │
│ memory/topic-testing.md                     │
├─────────────────────────────────────────────┤
│ Reason                                      │
│ session-012 corrected Jest → Vitest         │
│                                             │
│ Evidence                                    │
│ session-012: "switched to Vitest — ESM      │
│ compatibility"; session-014: used without   │
│ question                                    │
│                                             │
│ Before → After                              │
│ "use Jest for unit tests"                   │
│ ↓                                           │
│ "use Vitest (migrated session-012, ESM)"    │
│                                             │
│ Confidence                                  │
│ 0.88  ↑ from 0.60                          │
│ ████████████░░░░  88%                       │
│                                             │
│ Risk if skipped                             │
│ Claude will keep suggesting Jest commands   │
│ that fail on this project                   │
│                                             │
│ Source session                              │
│ [session-012 ↗](https://claude.ai/chat/…)  │
└─────────────────────────────────────────────┘
```

**Side panel implementation:**
- Fixed-position panel, width 340px, slides in from right on row click
- Close with ✕ button or clicking outside the panel
- Confidence shown as both a number and a mini progress bar
- Before → After shown as two distinct blocks with a ↓ arrow between them
- Session URL rendered as a clickable link that opens the conversation
- Operation type colour-coded: ADD=teal, UPDATE=amber, DELETE=red, PROMOTE=dark teal, DEMOTE=amber
- If justification block is missing for an older log entry, show "No justification recorded — run written before justification blocks were introduced"

**The operations table** for each dream run is expandable (▶ toggle). Collapsed shows
the summary counts. Expanded shows each operation as a clickable row:

```html
<tr class="op-row" onclick="openPanel(opData)" style="cursor:pointer">
  <td><span class="op-badge op-update">UPDATE</span></td>
  <td>test runner</td>
  <td>0.88</td>
  <td><a href="url">session-012 ↗</a></td>
</tr>
```

**9. MEMORY.md inbox status**
Current line count with a visual fill gauge (like a fuel gauge).
Green 0–150, amber 150–180, red 180+.
List any entries in MEMORY.md that have been there for 3+ dream cycles without
being processed, with a link to the session that wrote them if resolved.

### Chart implementation (SVG-only)

All charts must use inline SVG. Example pattern for the confidence bar chart:

```html
<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
  <!-- bars drawn as <rect> elements with calculated widths -->
  <!-- labels as <text> elements -->
</svg>
```

For the decay curve line chart:
```html
<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
  <!-- grid lines as <line> elements -->
  <!-- data points connected by <polyline> or <path> -->
  <!-- threshold lines as dashed <line> elements -->
  <!-- axis labels as <text> elements -->
</svg>
```

---

## Step 4 — Populate with real data

Use the actual numbers you computed in Step 2.
Do not use placeholder data or example values.
If a metric cannot be computed (e.g. no dream-log.md exists yet), show "No data yet" gracefully.

---

## Step 5 — Write the file and confirm

Use the **Write** tool to create the file at `memory/health.html` with the complete
HTML content generated in Step 3. Do not print the HTML to the conversation —
write it directly to disk using the Write tool.

If `memory/` does not exist, create it first:
```
!mkdir -p memory
```

After writing, confirm with:
```
Health dashboard generated → memory/health.html
Open in any browser to view.

Summary:
- N total entries across N topic files
- Average confidence: X.XX  [color indicator]
- N entries at risk (score ≤ 0.3)
- N entries ready to promote (score ≥ 0.85)
- MEMORY.md: N lines [status]
- Last dream: N sessions ago
```

---

## Rules

- Read-only. Never modify CLAUDE.md, MEMORY.md, topic files, or dream-log.md.
- Use real computed values only. Never invent or estimate data.
- The HTML must open and render correctly in a browser without any server.
- If dream-log.md has no entries yet, the decay curve section shows a "No dream runs yet" message.
- If no topic files exist yet, topic coverage shows only CLAUDE.md and MEMORY.md rows.
