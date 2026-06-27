# 0022 — Guide versioning contract
Status: Accepted · Date: 2026-06-11

## Problem
Guides drifted silently — user-guide.html and plugin-guide-v9.html documented
v1.21.0 while the plugin was at v1.23.0. The validator had no check, and the
report-exit block bug meant even added checks never ran.

## Decision
Machine-readable stamp in every guide: <!-- documents-plugin-version: X.Y.Z -->.
Validator check 29: >1 minor behind = release-blocking error. Check 30: every
command in user-guide, every shared spec in plugin-guide. bump-version.sh
surfaces guide staleness during every bump. Guides update as part of the release,
not as an afterthought.

## Revisit when
A third guide is added (e.g. admin guide) — extend the stamp contract and
validator to cover it.
