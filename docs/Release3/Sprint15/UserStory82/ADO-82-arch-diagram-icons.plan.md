# Feature Plan — /arch-diagram: Azure Architecture Icons in the rendered diagram
ADO #82 · Release R3 · Sprint S15
Status: ✅ Approved — critic PASS WITH NOTES, lightweight governance (2026-11-18); open questions accepted (SAVE PLAN CONFIRM)
Branch: `feature/ADO-82-arch-diagram-icons` (from local `main` bb20933; `git fetch` failed at branch time)
Governance: lightweight (developer choice, 2026-11-18)

---

## Problem Statement

`/arch-diagram` draws every component as a coloured box with a text label. The only icons are two
shapes drawn in code: a database cylinder and a user screen. Architecture reviews (DRB, DR plans,
go-live packs) expect the standard Azure icons. Without them, teams either redraw the diagram in
Visio or hand-write SVG to get a reviewable picture. ADO-8001 left icon packs out of scope on
purpose ("No SVG, draw.io or Visio output and no vendor icon packs"). This ADO reverses that
decision for Azure icons only; the PNG-only output decision stands.

**Success:** a spec that uses Azure component types renders with the official Azure icon in each
box, without changing the spec. Specs written for ADO-8001 still render with no errors, and every
example spec still passes `--check` with no problems. Boxes whose type gets no icon keep exactly
their ADO-8001 size and position; boxes that gain an icon may re-wrap their text into the icon slot
and grow taller. Users need no new dependencies.

## Story

As a developer producing an architecture or DR diagram with `/arch-diagram`, I want each Azure
component drawn with its official Azure icon, so that the diagram reads like a standard
architecture drawing and can go straight into a DRB pack.

## Personas

- **Developer:**
  - Produces the diagram a DR plan, DRB submission or runbook asks for.
  - Frustration: the generated PNG looks unlike the Visio diagrams reviewers are used to, so it gets redrawn by hand.
  - Success: the `/arch-diagram` PNG goes into the pack as it is.
- **Reviewer (Enterprise / Security Architect):**
  - Reads many diagrams across applications.
  - Success: recognises each Azure component at a glance, from the standard icon.

## Feature Priority (MoSCoW)

**Must Have:**
1. **Bundled icon assets.**
   - `assets/icons/azure/` holds about 30 PNG icons at 128 px with transparent backgrounds, converted from Microsoft Azure Architecture Icons V25.
   - Each existing component type that has an Azure counterpart gets one icon. The new types in Must Have 4 get one each.
   - Story 1 starts by adding the type → icon table to this plan's Revision Log for review; PNGs are built only from that table.
   - `manifest.json` maps each icon name to its file, its source SVG path and the icon-set version.
   - Expected total size: under 250 KB.
2. **Licence notice.** `assets/icons/azure/NOTICE.md` records the source URL, the version and Microsoft's terms of use, and states that the icons are not covered by the repo's MIT licence. The README licence section links to it.
3. **Renderer support** (`scripts/architecture-diagram.py`):
   - Draws a type's PNG icon in the existing icon slot, using `matplotlib.image`, so no new dependency.
   - An optional per-component `icon:` key overrides the type's icon; `icon: ""` hides it.
   - An unknown icon name prints a stderr warning and falls back to the type's built-in icon or no icon. It never fails the render, matching how unknown types behave today.
   - If the assets folder is missing, the diagram renders exactly as it does today.
   - Assets are found relative to the script, so it works from any working directory.
4. **New component types:** `event-hubs`, `service-bus`, `log-analytics`, `private-endpoint`, `network-interface`, `vnet`, `expressroute` and `entra-app`. Each gets a colour preset, a type label and an icon.
5. **Repeatable conversion** with `scripts/build-azure-icons.cjs`. It is for maintainers only and is never run by the skill or by users.
   - **Input:** the extracted Microsoft icon zip and `manifest.json`.
   - **Output:** the PNGs, rendered with headless Edge or Chrome on a transparent background.
   - **Re-runs:** running it again on the same input gives the same file names.
   - **Upgrades:** moving to a later icon release means re-running it with the new zip.
   - **Missing source:** a manifest entry whose source SVG is not in the zip fails the build with the entry named.
6. **Tests** (`tests/architecture-diagram.test.cjs`):
   - the icon is drawn for a known type
   - the `icon:` override and `icon: ""` behave as described
   - an unknown icon name warns but still renders
   - removing the assets folder changes nothing
   - every existing example spec still passes `--check`
   - every `manifest.json` entry has a file on disk
7. **Docs and release:**
   - Update the renderer docstring (types and the `icon:` key) and `skills/arch-diagram/references/spec-format.md`.
   - Add a CHANGELOG entry.
   - Bump the version to 3.28.0 with `scripts/bump-version.sh`.
   - Amend the ADO-8001 plan's Won't Have line with a pointer to ADO-82.

**Should Have:**
- An optional `icon:` on zones (subscription, resource group, VNet), drawn before the zone name.
- Update `skills/arch-diagram/references/examples/azure-app-service.yaml` to use the new types.

**Could Have:**
- A `--no-icons` flag, for black-and-white printing.

**Won't Have:**
- No AWS, Kubernetes or Microsoft 365 (Exchange) icon packs. Each has separate terms. They can come later, using the same manifest pattern.
- No SVG or Visio output. The output stays PNG.
- No change to the skill's evidence collection or spec-generation steps. The LLM picks the new types the same way it picks types today.
- No full icon set (about 700 icons, several MB on every install).

## Release Plan

- **Story 1 — Assets:** build script, curated PNGs, manifest and notice.
- **Story 2 — Renderer:** icon drawing, the `icon:` key, new types, tests, docs, CHANGELOG and version bump.

## Assumptions

- matplotlib can read PNGs without help. It already depends on Pillow, so the renderer gains no new dependency.
- Headless Edge or Chrome is available on the maintainer's machine. It is needed only for Story 1, not by users.
- The installer copies `assets/` automatically, because `safeCopy` in `install.cjs` excludes only `.git`, `docs`, `.vs` and `node_modules`.

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Redistributing the icons breaches Microsoft's terms | L | H | NOTICE.md carries the terms; use is limited to architecture diagrams; sign-off is open question 1 |
| Icons change box sizes and break existing layouts | M | M | Icons use the existing fixed-width icon slot (`ICON_W`); an "existing examples pass `--check`" test |
| A badly chosen icon misleads a reviewer (for example the "Exchange On-Premises Access" building used for Exchange Online) | M | L | The icon choice for each type is reviewed before Story 1 ships; no icon is better than a wrong one |
| A future icon-set release renames files | M | L | The manifest keeps the source path and version; the build script fails loudly on a missing source |

## Pre-mortem

"This shipped and reviewers asked for the diagrams to be redrawn anyway." The likely causes are an
icon that means something else to a reviewer, or icons crowding the text in small boxes.
Mitigation: a reviewed type-to-icon table, icons only in the existing fixed slot, and the existing
`--check` layout tests on every example.

## Dependencies

- Builds on ADO-8001 (`/arch-diagram`, release 3.27.0).
- Source: Microsoft Azure Architecture Icons V25 — https://learn.microsoft.com/azure/architecture/icons/

## Open Questions (accepted at plan save — SAVE PLAN CONFIRM)

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Does committing the icons to the shared plugin repo need approval beyond Microsoft's terms (firm legal or IP)? | Vivek Rawat | open |
| 2 | Release R3, Sprint S15: is that correct? | Vivek Rawat | open |
| 3 | Is the curated set of about 30 icons right, rather than the full set? | Vivek Rawat | assumed yes |

---
### Revision Log
2026-11-18 — Plan drafted and saved (SAVE PLAN ADO-82 CONFIRM), lightweight governance. Origin: the MailIngest DRB low-level design needed Azure icons that `/arch-diagram` could not draw.
2026-11-18 — Critic (plan, lightweight): PASS WITH NOTES. Success line reworded (boxes that gain an icon may re-wrap; others unchanged); type → icon table added as the first step of Story 1. Stamped ✅ Approved.
2026-11-18 — Story 1 type → icon table, approved by the developer (`APPROVE ADO-82`). Rule: only types that are clearly Azure services get an Azure icon by default, per Microsoft's terms ("use the icons as they would appear within Azure"). All 34 sources verified present in V25.

| Group | Types → icon (V25 file stem) |
|---|---|
| A. Default icon (19 types) | aks → Kubernetes-Services · app-service → App-Services · function-app → Function-Apps · front-door → Front-Door-and-CDN-Profiles · app-gateway → Application-Gateways · key-vault → Key-Vaults · storage → Storage-Accounts · azure-sql → SQL-Database · app-insights → Application-Insights · container-apps → Container-Apps-Environments · users → Users · event-hubs → Event-Hubs · service-bus → Azure-Service-Bus · log-analytics → Log-Analytics-Workspaces · private-endpoint → Private-Endpoints · network-interface → Network-Interfaces · vnet → Virtual-Networks · expressroute → ExpressRoute-Circuits · entra-app → App-Registrations |
| B. Bundled, opt-in via `icon:` only (15) | Virtual-Machine · Load-Balancers · Firewalls · Container-Registries · Azure-DevOps · Monitor · DNS-Zones · DNS-Private-Resolver · Subscriptions · Resource-Groups · Subnet · Managed-Identities · Recovery-Services-Vaults · SQL-Server · Worker-Container-App |
| C. No icon by default | vm · firewall · load-balancer · registry · pipeline · dns · monitoring · sql-server · kubernetes · identity · database · file-share (and all non-Azure types) |
