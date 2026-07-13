---
paths: ["**/*.html", "**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.astro"]
detect:
  dependencies: ["tailwindcss"]
---

# Tailwind CSS Rules — Applied to all Tailwind projects

## Class Ordering
- Follow the Prettier Tailwind plugin order (layout → spacing → typography → colours → effects)
- Install and use `prettier-plugin-tailwindcss` — never argue about class order in review
- Group related utilities with a space-comment in complex components: layout | spacing | typography

## Extraction Threshold
- Extract a component when the same utility combination appears 3+ times — do not repeat long `className` strings
- Use `@apply` sparingly and only in base layer or genuine design-system tokens — not as a substitute for components
- Prefer extracting a React/Vue/Svelte component over an `@apply` class for interactive UI elements

## Responsive Design
- Mobile-first: write the base style first, then add `sm:` / `md:` / `lg:` breakpoint modifiers
- Never write desktop-only styles without a mobile fallback
- Use `container` with `mx-auto` and `px-{n}` padding — never hard-code pixel widths for layout containers

## Dark Mode
- Use the `dark:` variant for all colour and background overrides — never a separate CSS file for dark mode
- Configure `darkMode: 'class'` in `tailwind.config.ts` for programmatic toggling
- Test both light and dark modes in component tests and E2E

## Spacing and Sizing
- Use the design system scale (multiples of 4 px) — avoid arbitrary values (`w-[347px]`) unless matching a fixed external constraint
- `p-{n}` / `m-{n}` for uniform padding/margin; `px-` / `py-` for axis-specific — never mix `p-` with manual overrides on the same element

## Custom Utilities and Plugins
- Define design tokens in `tailwind.config.ts` under `theme.extend` — not as arbitrary values in markup
- Tailwind plugins for repeated custom patterns — not raw CSS files alongside Tailwind
- Never override Tailwind's default scale values — use `extend` only

## Out of bounds
- No inline `style={{}}` alongside Tailwind classes — pick one approach per element
- No `!important` modifier (`!text-red-500`) in production code — fix the specificity issue instead
- No arbitrary values for colours that should be design tokens: `text-[#3b82f6]` → `text-blue-500`
- No `@apply` for interactive component styles — extract a component instead
