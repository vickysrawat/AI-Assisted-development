---
description: Zero-cost session warm-up — loads CLAUDE.md, memory, and architecture context in one pass, and performs a lightweight plugin version-drift check (provisioned dream_init_plugin_version vs installed plugin.json version). If the installed plugin is newer than the version that provisioned the project, surfaces a one-line "plugin upgraded {old} -> {new}, run /setup-sync" notice so upgrades are announced on the first interaction rather than silently assumed in place. Run at the start of every session.
---
<command>session-start</command>
