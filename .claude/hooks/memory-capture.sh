#!/usr/bin/env bash
# hooks/memory-capture.sh — bash path: delegates to the pure Node.js implementation.
# All logic lives in memory-capture.cjs — the .sh is a thin shim for bash environments.
exec node "$(dirname "$0")/memory-capture.cjs"
