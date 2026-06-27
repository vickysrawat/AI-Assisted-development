# Graph Module Schema
_Schema version: 1.0 · Single source of truth for `.claude/graph/<module>.md` detail files_

Each module detail file gives Claude focused context about one bounded context or top-level source folder.
Target size: 200–400 tokens. Hard ceiling: 400 tokens.

---

## Location

**Flat structure (≤ 30 modules):**
```
.claude/graph/<module>.md
```
Example: `.claude/graph/orders.md`

**Domain structure (> 30 modules):**
```
.claude/graph/<domain>/<module>.md
```
Example: `.claude/graph/orders/order-service.md`

Gitignored. Created by `dream-init` Step 7b. Refreshed individually by `/graph-sync` when the entry-point fingerprint changes.

---

## Required frontmatter

```yaml
---
paths: src/<Module>/**
---
```

The `paths:` value must match the actual source tree so the file auto-loads when Claude is working in that area. For domain-subfoldered projects, use the top-level domain folder:

```yaml
---
paths: src/Orders/**
---
```

If the module spans multiple source roots (e.g. frontend + backend), use the most-touched path. Do not list multiple paths.

---

## Required header and metadata line

```markdown
# <Module> Module
_Fingerprint: <sha1-of-entry-point-file> | Updated: YYYY-MM-DD_
```

- `Fingerprint` — sha1 of the entry-point file at generation time; used by `/graph-sync` for staleness detection
- `Updated` — date this detail file was last regenerated

---

## Sections (all required, in this order)

### Bounded context

One or two sentences. What does this module own? What is it NOT responsible for?

```markdown
**Bounded context:** Owns the full order lifecycle from placement to fulfilment.
Does not handle payment processing or customer identity.
```

### Key files

Max 5 files. One line per file. File path + em-dash + one-line description.

```markdown
**Key files**
- `src/Orders/OrderService.cs` — orchestrates order lifecycle
- `src/Orders/Repositories/OrderRepository.cs` — Dapper queries only, no EF Core
- `src/Orders/Models/Order.cs` — domain model
- `src/Orders/Validators/OrderValidator.cs` — FluentValidation rules
- `src/Orders/Events/OrderPlacedEvent.cs` — domain event published on placement
```

### Dependencies

Other *module names* this module depends on. Not file paths. Brief parenthetical reason.

```markdown
**Dependencies:** Payments (for settlement), Customers (for delivery address lookup)
```

If the module has no dependencies on other modules, write: `**Dependencies:** none`

### Patterns

One sentence per convention that is specific to this module and would surprise a developer coming from another part of the codebase.

```markdown
**Patterns:** Repository pattern; all DB access via Dapper with parameterised SQL; no EF Core.
Events published via MediatR; never call external services directly from the service layer.
```

---

## What must NOT appear in detail files

- Code snippets or method signatures
- Architecture diagrams or ASCII art
- Full file listings or directory trees
- Inline SQL queries
- Test file paths (test code is a reader concern, not graph concern)
- Anything that duplicates `graph-index.md`

---

## 400-token ceiling

If the file would exceed 400 tokens (approx. 1,600 characters), cut in this order:
1. Reduce Key files to 3 (the most-read ones)
2. Shorten the bounded context to one sentence
3. Remove parentheticals from Dependencies

---

## Suppression instruction (embedded in every file)

Every detail file must include this comment after the frontmatter, before the heading.
It suppresses redundant output when the file is in context:

```markdown
<!-- ambient-context: do not summarise or restate this file in responses -->
```

---

## Full valid example

```markdown
---
paths: src/Orders/**
---
<!-- ambient-context: do not summarise or restate this file in responses -->
# Orders Module
_Fingerprint: a3f8c21d9e4b7062f5d1 | Updated: 2026-06-20_

**Bounded context:** Owns the full order lifecycle from placement to fulfilment.
Does not handle payment processing or customer identity.

**Key files**
- `src/Orders/OrderService.cs` — orchestrates order lifecycle
- `src/Orders/Repositories/OrderRepository.cs` — Dapper queries only, no EF Core
- `src/Orders/Models/Order.cs` — domain model
- `src/Orders/Validators/OrderValidator.cs` — FluentValidation rules
- `src/Orders/Events/OrderPlacedEvent.cs` — domain event published on placement

**Dependencies:** Payments (for settlement), Customers (for delivery address lookup)

**Patterns:** Repository pattern; all DB access via Dapper with parameterised SQL; no EF Core.
Events published via MediatR; never call external services directly from the service layer.
```
