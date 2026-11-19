# Tracker — arch-diagram-icons [LIGHTWEIGHT]
ADO #82 · governance: lightweight · plan: `ADO-82-arch-diagram-icons.plan.md`

| AC | Must Have item | Story | Status |
|---|---|---|---|
| AC-F1 | Bundled icon assets: curated 128 px PNGs in `assets/icons/azure/` + `manifest.json` | 1 | ✅ Done |
| AC-F2 | Licence notice `assets/icons/azure/NOTICE.md`, linked from the README | 1 | ✅ Done |
| AC-F3 | Renderer draws PNG icons; `icon:` key; safe fallbacks | 2 | ✅ Done |
| AC-F4 | New component types (event-hubs, service-bus, log-analytics, private-endpoint, network-interface, vnet, expressroute, entra-app) | 2 | ✅ Done |
| AC-F5 | Repeatable conversion `scripts/build-azure-icons.cjs` (maintainer-only) | 1 | ✅ Done |
| AC-F6 | Tests in `tests/architecture-diagram.test.cjs` | 2 | ✅ Done |
| AC-F7 | Docs, CHANGELOG, version 3.28.0, ADO-8001 plan pointer | 2 | ✅ Done |

## Story 1 — Assets
**Status:** ✅ Done (2026-11-18)

- 2026-11-18 — Type → icon table approved by the developer (`APPROVE ADO-82`); recorded in the plan's Revision Log.
- 2026-11-18 — Dry run in a scratch copy: 34 PNGs, 128 × 128, transparent, 213 KB, 8 m 44 s (one headless Edge start per icon). Code critic: PASS WITH NOTES. Written after `APPROVE ADO-82`: `scripts/build-azure-icons.cjs`, `assets/icons/azure/` (manifest.json, NOTICE.md, 34 PNGs), README (Licence section + tree line).
- Verified in place: usage error exits 2; 0 missing sources against V25; 0 PNG size problems; a wrong folder reports all 34 as missing.

### Follow-ups
| # | Issue | Fix | Files |
|---|---|---|---|
| 1 | Build starts one browser per icon (~15 s each) | Accepted for a maintainer-only tool; noted in the plan | scripts/build-azure-icons.cjs |
| 2 | PNGs dropped from the manifest are not deleted, and "every entry has a file" won't catch them | Story 2: add the reverse test (every PNG is in the manifest) | tests/architecture-diagram.test.cjs |

## Story 2 — Renderer
**Status:** 🔄 In Progress (2026-11-19)

- 2026-11-19 — Dry run in a scratch copy (`C:\tmp\ado82-s2`): all 5 examples `check: ok`; code critic PASS WITH NOTES. Written after `APPROVE ADO-82`; version bumped to 3.28.0 with `scripts/bump-version.sh`.

### Delivered
- `renderer`: `AZURE_ICONS` type → icon table, `load_icons()` manifest loader, `Node.pick_icon()` (`icon:` key, `""` hides, unknown name warns), PNG branch in `draw_icon()` via `matplotlib.image`; 8 new types (`scripts/architecture-diagram.py`)
- `docs`: renderer docstring (AZURE ICONS section, `icon:` key); "Azure icons (ADO-82)" section in `skills/arch-diagram/references/spec-format.md`; ADO-8001 plan Won't Have pointer
- `release`: 3.28.0 (`.claude-plugin/plugin.json`, `CLAUDE.md` label), `CHANGELOG.md` entry

### Tests added
- `tests/architecture-diagram.test.cjs` — 10 new cases (37 total): manifest ↔ PNGs both ways (no Python; closes Story 1 follow-up 2); known type draws its icon; `icon:` override; `icon: ""`; built-in shape kept for non-Azure types; unknown icon warns and renders; 8 new types known with icons; every default icon in the manifest; no assets folder → built-in icons, no warnings, same layout

### Design decisions
- **Unknown `icon:` name:** warn and keep the type's usual icon — same as leaving the key out. Rejected: spec error (a typo would stop the diagram), no icon (box loses its icon).

### Known gaps
- Boxes with children (App Service plan, AKS cluster, vnet with subnets) show no icon — only plain boxes have the icon slot.
- `skills/arch-diagram/references/evidence-map.md` does not map resources to the 8 new types, so generated specs may not use them (plan Won't Have: no change to spec generation).
- Should Have (zone `icon:`, updated `azure-app-service.yaml`) and Could Have (`--no-icons`) not done.
- Release reminders from `bump-version.js`: README version paragraph says 3.27.0; both guides document 3.26.0.
- `tests/validate.py` needs `PYTHONUTF8=1` on Windows (cp1252 decode error) — pre-existing.

### Lessons learned
_(Clean delivery — no recurring patterns identified in this story)_
