---
paths: ["**/*.css", "**/*.pcss"]
detect:
  files: ["**/*.css", "**/*.pcss"]
---

# CSS Rules — Applied to all plain CSS files

Modern CSS (Grid, Flexbox, custom properties, container queries). Does not apply to
`.scss`/`.sass` files (see `sass-rules.md`) or `.module.css` files (see `css-modules-rules.md`).

## Layout — Grid
- Use CSS Grid for two-dimensional layouts (rows AND columns)
- Prefer named grid areas for complex layouts — makes intent clear:
  ```css
  grid-template-areas: "header header" "sidebar main" "footer footer";
  ```
- Use `minmax(0, 1fr)` instead of `1fr` to prevent overflow in grid tracks
- `gap` not `margin` for spacing between grid/flex children

## Layout — Flexbox
- Use Flexbox for one-dimensional layouts (row OR column)
- Always set `min-width: 0` on flex children that contain long text or need to shrink
- Use `flex: 1 1 0` (not `flex: 1`) when you want equal-width flex items
- Avoid nesting Flexbox and Grid more than 3 levels deep — extract a component

## Container Queries
- Use `@container` for component-level responsive behaviour instead of `@media` where the container size is the relevant constraint
- Name containers with `container-name` when multiple containers are in scope: `container-name: card`
- Container queries belong alongside the component's CSS — not in a global breakpoint file

## Custom Properties (CSS Variables)
- All design tokens defined as custom properties on `:root` or a theme class
- Naming convention: `--color-primary`, `--spacing-md`, `--font-size-base` (category-then-qualifier)
- Never hard-code token values elsewhere in CSS — always reference the variable
- Fallback values only for properties that genuinely need a safe default: `var(--color-text, #000)`

## Naming (BEM-inspired)
- Block: `.block`, Element: `.block__element`, Modifier: `.block--modifier`
- No deep nesting (`.a .b .c .d`) — flatten with BEM names
- No global single-word class names (`.button`, `.text`) — always namespace to the component

## Animation and Transitions
- Use `transition` only for properties that change on user interaction — not on initial render
- `will-change: transform` only when a profiler confirms it improves performance — it consumes GPU memory
- Respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  ```
- Prefer `transform` and `opacity` for animations — avoid animating `width`, `height`, `top`, `left` (layout thrash)

## Typography
- `font-size` in `rem` (relative to root) — never `px` for text (accessibility: user font size preference)
- Line height unitless: `line-height: 1.5` — not `line-height: 24px`
- `clamp()` for fluid typography: `font-size: clamp(1rem, 2.5vw, 1.5rem)`

## Out of bounds
- No `!important` — fix specificity instead
- No `position: absolute` without a positioned parent — always set `position: relative` on the container
- No vendor prefixes by hand — use PostCSS Autoprefixer
- No pixel font sizes — use `rem`
- No `zoom` property — use `transform: scale()` for visual scaling
