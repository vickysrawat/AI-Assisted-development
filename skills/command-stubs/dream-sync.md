---
description: "Re-provision an existing project after a plugin upgrade. Compares the provisioned version (dream_init_plugin_version in .claude/dream-init-state.json) against the installed version (.claude-plugin/plugin.json) and applies only the version-sensitive changes listed in docs/migrations/ for each version in range — re-copies hooks and refreshes .claude/hooks/.hashes, re-runs the VCS-aware ignore writer (.gitignore/.tfignore), seeds any new state files, deploys missing rule files — then re-stamps dream_init_plugin_version. Idempotent and safe to re-run; never overwrites developer content, only managed blocks and generated artifacts. Use when dream-status reports plugin version drift (UPGRADE PENDING). Alias: dream-init --upgrade."
argument-hint: "(no arguments needed)"
---
<command>dream-sync</command>
