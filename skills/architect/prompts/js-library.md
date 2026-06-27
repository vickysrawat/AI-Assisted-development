# Prompts — Custom JS/TS Library

---

## File 1 Prompt — architecture.md

You are a software architect documenting a JavaScript/TypeScript library.
Read in order: package.json, tsconfig.json, the main entry file(s),
and src/ folder structure.

Populate architecture.md completely:

**Technology Stack** — TypeScript version, build tool (Rollup, tsup, esbuild, tsc),
bundle targets (ESM, CJS, UMD, IIFE), test framework, documentation tool.

**Package Metadata** — from package.json: name, version, description,
main/module/exports fields, peerDependencies, engines constraints.

**Folder Structure** — list src/ top-level folders with their purpose.
Identify the public API entry point(s) (index.ts or exports map).

**Public API Surface** — read the main index.ts export.
List every exported function, class, type, interface, and constant with
a one-line description of what it does. Group by category if there are many.

**Internal Module Map** — list the internal modules/folders that the
public API is built from, and their responsibilities.

**Bundle Targets** — document what formats are built, their output files,
and their intended consumers (Node.js, browser, both).

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-api.md

You are documenting the full public API surface of a JS/TS library.
Read every exported symbol from the main entry point and trace into
the implementation files.

For each exported function/method:
- Signature: name, parameters (name, type, required/optional, default),
  return type
- Description: what it does in one or two sentences
- Side effects: any globals mutated, DOM interactions, async behaviour
- Throws: error conditions it raises

For each exported class:
- Constructor signature
- Public methods (signature + description)
- Public properties
- Static members

For each exported type/interface:
- All fields with types and whether required or optional

Group exports into logical categories.

Then document usage patterns:
- Installation and basic setup
- The three most common usage examples with code
- Known gotchas or constraints

Read actual implementation files — do not infer from names alone.

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a JS/TS library.

**npm Package Versions** — all dependencies and devDependencies with exact versions.

**Build Configuration** — read tsup.config, rollup.config, or equivalent.
Document: entry points, output formats, external packages, sourcemap config,
declaration file generation.

**Known Consumers** — if the repo contains example/, demo/, or test/
directories that import the library, list them and note what they demonstrate.

**Publish Configuration** — read package.json: publishConfig, files array,
prepublish/postpublish scripts. Describe the publish process.

**Changelog / Version History** — if CHANGELOG.md exists, summarise
the last 5 versions and what changed.
