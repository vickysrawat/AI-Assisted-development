# token-graph.json — Schema Reference

Location: `token-analysis/token-graph.json` (project root)
Gitignored: yes — added by `setup-init` via `token-analysis/` entry in `.gitignore`

## Purpose

Persistent cache that makes subsequent `token-analysis` runs fast and cheap.
On first run the full scan populates it. On subsequent runs only the delta
(new sessions, changed files) is processed. The graph is never committed —
it is machine-generated and user-specific.

## Version history

| Version | Change |
|---------|--------|
| 1 | Initial schema |

## Full schema

```json
{
  "version": 1,
  "generatedAt": "ISO-8601 datetime",
  "projectRoot": "absolute path to project root",

  "files": {
    "<relative-file-path>": {
      "chars": 4820,
      "tokens": 1205,
      "loadType": "ALWAYS | CONDITIONAL | ON_DEMAND",
      "scope": "paths: value from frontmatter, or 'always' or 'manual'",
      "charCountAsHash": 4820
    }
  },

  "sessions": {
    "<session-id>": {
      "title": "Session title from recent_chats",
      "date": "YYYY-MM-DD",
      "turns": 12,
      "humanChars": 3200,
      "assistantChars": 18400,
      "toolResultChars": 6800,
      "estimatedTokens": 7100,
      "costIndex": 9.2,
      "skillsInvoked": ["icea-feature", "pr-describe"],
      "filesRead": ["CLAUDE.md", "src/Services/SearchService.cs"],
      "promptTypes": {
        "efficient": 5,
        "vague": 3,
        "redundant": 1,
        "multiTask": 2,
        "correction": 1
      },
      "expensivePrompts": [
        {
          "preview": "first 200 chars of the prompt",
          "type": "vague | redundant | multiTask | correction",
          "estimatedTokens": 1200
        }
      ]
    }
  },

  "aggregates": {
    "computedAt": "ISO-8601 datetime",
    "sessionCount": 10,
    "avgTokens": 6200,
    "avgTurns": 9,
    "correctionRate": 0.18,
    "topSkills": [["icea-feature", 8], ["pr-describe", 4]],
    "topFiles": [["CLAUDE.md", 10], [".claude/rules/dotnet-rules.md", 7]],
    "promptTypeDistribution": {
      "efficient": 0.42,
      "vague": 0.28,
      "redundant": 0.12,
      "multiTask": 0.10,
      "correction": 0.08
    },
    "trend": {
      "direction": "improving | stable | degrading",
      "evidence": "one sentence",
      "firstHalfAvgTokens": 7400,
      "secondHalfAvgTokens": 5800,
      "firstHalfCorrectionRate": 0.24,
      "secondHalfCorrectionRate": 0.12
    }
  },

  "recommendations": {
    "REC-P01": {
      "status": "open | resolved",
      "firstSeen": "YYYY-MM-DD",
      "lastSeen": "YYYY-MM-DD",
      "resolvedAt": null
    }
  },

  "staticStatus": {
    "alwaysTokens": 1840,
    "typicalTokens": 3200,
    "maxTokens": 12400,
    "ragStatus": "GREEN | AMBER | RED",
    "lastAuditedAt": "ISO-8601 datetime"
  }
}
```

## Empty graph (seeded by setup-init)

```json
{
  "version": 1,
  "generatedAt": null,
  "projectRoot": null,
  "files": {},
  "sessions": {},
  "aggregates": null,
  "recommendations": {},
  "staticStatus": null
}
```

## Delta detection rules

| What changed | Action |
|---|---|
| File `charCountAsHash` differs from current `wc -c` | Re-measure that file, update entry |
| File exists in registry but not on disk | Remove from registry, flag in report |
| File on disk but not in registry | Add to registry as new |
| Session ID in `recent_chats` but not in `sessions` | Analyse and add |
| Session ID in `sessions` but not in `recent_chats` | Keep in registry (history) |
| `aggregates.computedAt` is older than newest session date | Recompute aggregates |
| All files and sessions unchanged | Skip all computation, generate report from cache |
