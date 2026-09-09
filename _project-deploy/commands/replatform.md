---
name: replatform
description: >
  Hosting/topology migration (on-prem → cloud). Classifies the 6R posture, captures an NFR spec as the
  primary intent, decomposes by cloud capability (landing-zone Tier-0), and authors IaC + config +
  pipeline + human-executable migration/reconciliation/cutover/rollback runbooks. The LLM authors +
  rehearses; a human executes anything touching real infra/data. "Done" = NFR assurance
  (measurability-ceilinged) + Well-Architected + behavioral regression.
  Usage: /replatform ADO-<id>
---

Invoke skill at $PLUGIN_DIR/skills/replatform/SKILL.md
