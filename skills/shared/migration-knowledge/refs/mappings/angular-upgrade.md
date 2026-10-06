# Parity Mapping: Angular version upgrades

_Loaded when source = `angular` for in-place same-stack version upgrades._

> **Scope — same-stack only.** Covers Angular 14–17 → 19 upgrades.
> Does NOT apply to Angular → React migrations (`angular-react.md`).
> Use `ng update` as the deterministic upgrade tool — the upgrade skill calls it in Step 2.

---

## Overview

Angular uses semantic versioning with one major per ~6 months. The `ng update` CLI handles
most migrations automatically (schematics). Remaining manual work covers:
1. `ng update @angular/core @angular/cli` — runs migration schematics
2. Fix any residual TS strict-mode / template errors
3. Update third-party Angular packages (Material, CDK, NgRx, etc.)

---

## Pre-hop considerations — before running ng update

### ng update scope — community packages require manual updates

`ng update` only auto-upgrades packages that implement the `ng-update` key in their `package.json`
(i.e. they ship Angular update schematics). Packages without this key are silently left at their
current version. [VERIFIED — angular.dev/cli/update, angular-cli GitHub #25920]

Packages `ng update` typically covers automatically:
- `@angular/core`, `@angular/cli`, `@angular/forms`, `@angular/router`, `@angular/common`, etc.
- `@angular/material`, `@angular/cdk` — ship their own schematics
- `@ngrx/store`, `@ngrx/effects` — ship schematics from v14+
- `typescript`, `zone.js` — updated as part of the Angular schematic

Packages that commonly require **manual** `npm install pkg@version` after `ng update`:
- Third-party component libraries (`ag-grid-angular`, `@swimlane/ngx-datatable`, PrimeNG, Syncfusion, etc.)
- `@ngx-translate/core` and similar i18n libraries
- Any internal/proprietary Angular library that does not publish `ng-update` schematics
- `rxjs` — verify against the Angular compatibility matrix; `ng update` may not bump it

After running `ng update`, check for packages left behind:
```bash
npm outdated                  # shows packages with newer versions available
npx check-peer-dependencies   # surfaces unmet peer dependency conflicts
npm explain <package-name>    # traces why a specific version was resolved
```

### Peer dependency conflicts — the npm equivalent of a stale version pin

After `ng update` upgrades Angular core, third-party packages pinned to older Angular major versions
create peer dependency conflicts. These appear as `UNMET PEER DEPENDENCY` warnings and can cause
runtime failures even when the build succeeds. [VERIFIED — npmjs.com/package/check-peer-dependencies]

Detect before committing:
```bash
npx check-peer-dependencies   # most comprehensive — shows full peer dep tree with conflicts
npm ls @angular/core          # verify all packages agree on the same Angular major version
npm explain <package-name>    # trace why a specific version was resolved
```

Fix: upgrade the conflicting third-party package to a version that declares the correct Angular peer
dependency. Do NOT use `--legacy-peer-deps` as a permanent fix — it masks real conflicts that will
surface at runtime.

---

## GREEN — Migrates Cleanly

| Component | Notes |
|---|---|
| `@Component`, `@NgModule`, `@Injectable` decorators | No changes to annotation model |
| Template syntax (`*ngIf`, `*ngFor`, `[ngClass]`) | No removal; new control flow syntax is additive in v17 |
| `HttpClient` / `HttpClientModule` | No breaking changes; standalone API additive |
| `RouterModule` / `router-outlet` | No breaking changes |
| `@Input()` / `@Output()` | No changes; signal-based inputs additive in v17 |
| `ngOnInit` / lifecycle hooks | No changes |
| Karma + Jasmine tests | No breaking changes; Jest migration optional |
| RxJS 7+ usage patterns | No breaking changes from Angular side |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM Angular 14

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Standalone components | Angular 14 introduced standalone; NgModule-based apps still valid but migration path exists. | M | LOW — NgModule still works |
| Typed reactive forms (`FormControl<T>`) | Strong typing introduced. Source with untyped `FormControl` gets typed automatically by schematic in some versions. | S | LOW |
| `inject()` function | Angular 14 introduced `inject()` as DI alternative to constructor injection. No migration needed; adoption is voluntary. | S | LOW |

### Migrating FROM Angular 15/16

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Required inputs (`@Input({ required: true })`) | Angular 16 added required inputs. Old `@Input()` still works. | — | LOW |
| `DestroyRef` / `takeUntilDestroyed` | Angular 16. Replaces `Subject + takeUntil`. Optional adoption. | S | LOW |
| Signal inputs (`input()`, `model()`) | Developer Preview in v17; stable in v18. Optional. | S | LOW |

### Migrating FROM Angular 17

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| New control flow (`@if`, `@for`, `@switch`) | Stable in v17. Replaces `*ngIf`, `*ngFor` structurally. Old directives NOT removed — migration optional, done by schematic. | S | LOW |
| Deferrable views (`@defer`) | Angular 17 stable. No migration needed; adoption is voluntary. | S | LOW |
| `NgOptimizedImage` required `width`/`height` | From v17: `NgOptimizedImage` issues errors for missing dimensions. | S | MEDIUM — console errors if using directive |

### Migrating FROM Angular 18

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Zoneless change detection (experimental) | Angular 18 experimental; Angular 19 developer preview. Not required unless opting in. | M | MEDIUM if adopting |
| `HttpClient` provideHttpClient default | `withFetch()` becomes default in Angular 19. `XhrFactory` removed for fetch-native. | S | MEDIUM — test interceptors |

---

## RED — Will Break

### Dependency compatibility

| Package | Common upgrade notes |
|---|---|
| `@angular/material` | Must match Angular major version. `ng update @angular/material` handles it. Theming system changed in v17 (Material 3). |
| `@angular/cdk` | Must match Angular major version. |
| `@ngrx/store`, `@ngrx/effects` | NgRx 17+ requires Angular 17+. Check NgRx changelog per major. |
| `rxjs` | Angular 16+ requires RxJS 7.4+. No breaking change if already on 7.x. |
| `typescript` | Each Angular major requires a specific TypeScript range. `ng update` fails with incompatible TS. |
| Third-party component libs | Verify peer dependency on Angular version before updating. |

### Removed APIs (cumulative)

- Angular 15: `ComponentFactory`, `ComponentFactoryResolver` — use `ViewContainerRef.createComponent()` directly.
- Angular 16: `@Optional()`, `@Host()`, `@Self()`, `@SkipSelf()` decorators deprecated (use `inject()` options).
- Angular 17: `BrowserModule.withServerTransition()` removed — use `provideClientHydration()`.
- Angular 18/19: `XhrFactory` removed when using fetch-based `HttpClient`.

---

## replacement_mappings

| Old | New | Scope |
|---|---|---|
| `ComponentFactoryResolver` | `ViewContainerRef.createComponent()` | Angular 15+ |
| `BrowserModule.withServerTransition()` | `provideClientHydration()` | Angular 17+ SSR apps |
| `XhrFactory` | (removed — use fetch-based HttpClient) | Angular 19+ |
| `@angular/material` v15 theming | Material 3 / `@use '@angular/material'` Sass API | Angular 17+ |

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `ComponentFactoryResolver` | Angular 15 | Deprecated; API removed in 17 | Replace with `ViewContainerRef.createComponent()` |
| `BrowserModule.withServerTransition` | Angular 17 | Removed | Replace with `provideClientHydration()` |
| `XhrFactory` | Angular 19 | Removed when using fetch HttpClient | Remove usage; ensure `withFetch()` in `provideHttpClient` |
| `NgOptimizedImage` | Angular 17 | Requires explicit `width`/`height` | Add `width` and `height` attributes to all `NgOptimizedImage` usages |
| `withServerTransition` | Angular 17 | Removed | Replace with `provideClientHydration()` |
| `@Optional()` | Angular 16+ | Decorator form deprecated | Migrate to `inject(Token, { optional: true })` |
| `takeUntil` | Angular 16+ pattern change | Not removed; `takeUntilDestroyed` preferred | Optional: migrate subscriptions to `takeUntilDestroyed(destroyRef)` |

---

## Migration Procedure

### Step 1 — Run ng update (one major at a time)
```bash
ng update @angular/core@{target} @angular/cli@{target}
# Angular supports only N→N+1 update per run
```

### Step 2 — Update Angular Material / CDK
```bash
ng update @angular/material@{target} @angular/cdk@{target}
```

### Step 3 — Update third-party Angular packages
```bash
ng update @ngrx/store@{target}  # if using NgRx
```

### Step 4 — Build and lint
```bash
# Run production build FIRST — surfaces template compilation errors and type errors cleanly
ng build --configuration=production
ng lint
```

### Step 5 — Run tests
```bash
ng test --watch=false
ng e2e  # if configured
```

> **Build order tip:** Always run `ng build --configuration=production` before `ng test`. The
> production build catches strict template type-checking errors that development builds may hide.
> Test failures caused by behavioral changes (automatic batching, lifecycle changes) are easier
> to isolate once the build is clean.

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| U1 | Angular core + CLI | `ng update` core/cli; fix schematic-generated changes |
| U2 | Angular Material / CDK | Theming migration, component API changes |
| U3 | Third-party libs | NgRx, third-party component library updates |
| U4 | Template modernization | Optional: migrate `*ngIf` → `@if`, `*ngFor` → `@for` |
| U5 | Test fixes | Fix broken tests from behavioral changes |

---

## Post-hop audit checklist

Run after EACH `ng update` hop before committing:

```
[ ] ng build --configuration=production → surfaces template + strict-mode type errors cleanly
[ ] npx check-peer-dependencies → detect unmet peer dep conflicts from stale third-party pins
[ ] npm outdated → identify community packages left behind by ng update
[ ] Manually bump packages NOT covered by ng update schematics:
      [ ] Third-party component libraries (PrimeNG, ag-grid-angular, Syncfusion, etc.)
      [ ] @ngx-translate/* and other i18n libraries
      [ ] Any internal library without ng-update schematics
      [ ] rxjs — verify version is in Angular's supported range
[ ] npm ls @angular/core → verify all packages resolve to the same Angular major version
[ ] ng lint → fix any lint rules added or changed by the new Angular major
[ ] ng test --watch=false → run full test suite; fix behavioral regressions
[ ] Check @angular/material theming — Material 3 changes apply from Angular 17+
```
