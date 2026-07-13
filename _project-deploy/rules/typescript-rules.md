---
paths: ["**/*.ts", "**/*.tsx"]
detect:
  files: ["tsconfig.json"]
  dependencies: ["typescript"]
---

# TypeScript Rules — Applied to all TypeScript files

Cross-cutting: applies to every TypeScript project regardless of framework.
Framework-specific files (`react-ecosystem-rules.md`, `nodejs-typescript-rules.md`, etc.)
add their own conventions on top of these foundations.

## Compiler Configuration
- `strict: true` in `tsconfig.json` — enables all strict checks; never disable individual ones without documented reason
- `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`
- `exactOptionalPropertyTypes: true` — distinguishes missing property from `undefined` value
- `moduleResolution: "bundler"` for frontend projects; `"node16"` or `"nodenext"` for Node.js backends

## Type Safety
- No `any` — use `unknown` when the type is genuinely unknown and narrow before use
- No type assertions (`as T`) without a comment explaining why type narrowing is insufficient
- No non-null assertions (`!`) without a comment — prefer explicit null checks or optional chaining
- Prefer `unknown` over `any` for external data (API responses, `JSON.parse` results) — then validate and narrow
- `satisfies` operator for object literals that must conform to a type without widening

## Interfaces and Types
- `interface` for object shapes that may be extended or implemented
- `type` for unions, intersections, mapped types, and conditional types
- Never use `{}` or `object` as a type — they are nearly useless; use `Record<string, unknown>` or a specific interface
- Exported types always explicitly named — no anonymous inline exports

## Generics
- Generic type parameters named descriptively when the context isn't obvious: `TEntity`, `TKey`, not just `T`
- Constrain generics as tightly as needed: `<T extends { id: string }>` rather than unconstrained `<T>`
- Avoid more than 3 generic parameters — extract a helper type if it grows beyond that

## Utility Types
- Use built-in utility types before writing manual mapped types: `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`, `Readonly<T>`, `Record<K, V>`
- `ReturnType<typeof fn>` and `Parameters<typeof fn>` to derive types from existing functions

## Type Narrowing
- Use discriminated unions (`kind: 'success' | 'error'`) for result types — not optional fields
- `in` operator and `typeof` for type guards — keep guards in a dedicated `guards.ts` file if reused
- `never` in exhaustive switch/if-else to catch unhandled variants at compile time:
  ```typescript
  const _exhaustive: never = value; // compile error if a variant is unhandled
  ```

## Enums vs const
- Prefer `const` objects with `as const` over TypeScript `enum`:
  ```typescript
  export const Status = { Active: 'active', Inactive: 'inactive' } as const;
  export type Status = typeof Status[keyof typeof Status];
  ```
- Never use `const enum` — it breaks across module boundaries and with isolatedModules

## Declaration Files
- `.d.ts` files for third-party library augmentations only — never put runtime logic in `.d.ts`
- Module augmentation in a dedicated `types/` directory — one file per module augmented

## Out of bounds
- No `any` — use `unknown` + narrowing
- No `// @ts-ignore` — use `// @ts-expect-error` with a comment explaining the expected error
- No `as any` casts — narrow the type instead
- No `const enum` — use `const` object with `as const`
- No `{}` or `object` as a type
