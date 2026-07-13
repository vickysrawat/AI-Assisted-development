---
paths: ["**/*.scss", "**/*.sass"]
detect:
  dependencies: ["sass", "node-sass", "dart-sass"]
---

# Sass / SCSS Rules — Applied to all Sass files

## Module System
- `@use` and `@forward` only — `@import` is deprecated and will be removed in Dart Sass 2.0
- Namespace `@use` imports: `@use 'tokens' as t;` — access via `t.$color-primary`
- `_partials.scss` prefixed with underscore — Sass will not compile them as standalone output files
- One entry point per compiled output file (e.g. `main.scss`) that orchestrates `@forward` calls

## Nesting
- Maximum 3 levels of nesting — beyond that, extract a new class or component
- Use nesting only for genuine parent–child relationships, not for specificity hacks
- The `&` parent selector for modifiers and states: `&:hover`, `&.is-active`, `&--modifier`
- Never nest an unrelated selector inside another just to scope it — create a separate rule

## Variables vs CSS Custom Properties
- Use CSS custom properties (`--var: value`) for values that need to change at runtime (dark mode, themes, JS access)
- Use Sass variables (`$var: value`) for compile-time constants (breakpoints, z-index scales, private design tokens)
- Never duplicate the same token in both forms — pick the appropriate tool for the use case

## Mixins
- Mixins for groups of properties that repeat together across selectors — not for single properties
- Document non-obvious mixin parameters with an inline comment
- Prefer `@mixin` + `@include` over `%placeholder` + `@extend` — `@extend` creates unexpected selector grouping in output
- Never `@extend` across files — selector grouping in compiled output becomes unpredictable

## Functions
- Sass functions for compile-time calculations: `math.div($a, $b)`, `color.adjust(...)`
- Never use the legacy `/` division syntax — use `math.div()` from `sass:math`

## File Organisation
```
styles/
  _tokens.scss      ← design tokens (colours, spacing, type scale)
  _mixins.scss      ← shared mixins
  _reset.scss       ← CSS reset / base
  components/
    _button.scss
    _card.scss
  main.scss         ← @forward everything
```

## Out of bounds
- No `@import` — use `@use` / `@forward`
- No nesting deeper than 3 levels
- No `@extend` across different files
- No legacy `/` division — use `math.div()`
- No `!global` variable mutations in mixins or functions — use parameters instead
