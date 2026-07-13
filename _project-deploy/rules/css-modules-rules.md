---
paths: ["**/*.module.css", "**/*.module.scss"]
detect:
  files: ["**/*.module.css", "**/*.module.scss"]
---

# CSS Modules Rules — Applied to all CSS Module files

## Class Naming
- camelCase class names — CSS Modules transforms them to locally-scoped identifiers imported as `styles.className`
- Descriptive names that reflect the role, not the visual appearance: `.filterPanel` not `.grayBox`
- No BEM separators (`__`, `--`) needed — CSS Modules provide the scoping that BEM naming achieves globally

## Composition
- Use `composes:` to inherit styles from another class in the same file:
  ```css
  .primaryButton {
    composes: button;
    background: var(--color-primary);
  }
  ```
- Use `composes: className from './other.module.css'` for cross-file composition — document the dependency
- Never use `composes:` across more than one level of indirection — it becomes hard to trace

## Usage in Components
- Import as a namespace: `import styles from './Component.module.css'`
- Access via `styles.className` — never string literals or concatenation
- Combine classes with a utility (e.g. `clsx`, `classnames`) — never template literals for conditional classes:
  ```tsx
  className={clsx(styles.button, isActive && styles.active)}
  ```
- Never apply global class names (without `styles.`) alongside module classes on the same element — mixing global and local scoping causes confusion

## Global Overrides
- Use `:global(.className)` sparingly — only for third-party library overrides that cannot be targeted otherwise
- Document every `:global` usage with a comment explaining why a scoped approach is insufficient

## Out of bounds
- No BEM naming conventions in module files — scoping is handled automatically
- No `!important` — resolve specificity through selector structure
- No kebab-case class names (`filter-panel`) — use camelCase (`filterPanel`) for clean JS access
- No global selectors without `:global()` wrapper
