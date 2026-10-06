# Parity Mapping: Java / Spring Boot version upgrades

_Loaded when source = `java` for in-place same-stack version upgrades._

> **Scope — same-stack only.** Covers Spring Boot 2.x → 3.x and Java 11/17 → 21 LTS upgrades.
> Does NOT apply to Java → .NET migrations (`java-dotnet.md`).

---

## Overview

Key upgrade axes:
1. **Java LTS hop** — Java 11→17, 17→21 (bytecode + API changes)
2. **Spring Boot 2.x → 3.x** — requires Java 17 minimum; migrates `javax.*` → `jakarta.*`
3. **Spring Security 5 → 6** — configuration API redesign

---

## Pre-hop blockers — check BEFORE upgrading

### Local JAR (`<systemPath>`) compatibility

If any `pom.xml` references pre-compiled JARs via `<scope>system</scope>` + `<systemPath>`, verify
each JAR's bytecode version before upgrading the Java LTS. A JAR compiled for Java 17 (major
version 61) will not load on Java 11 JVM. [VERIFIED — mkyong.com, Baeldung]

```bash
# Extract a class from the JAR and check its bytecode major version
jar xf path/to/library.jar com/example/SomeClass.class
javap -verbose SomeClass.class | grep 'major version'
# major version: 52 = Java 8 · 55 = Java 11 · 61 = Java 17 · 65 = Java 21
```

Fix: replace `<systemPath>` JARs with proper Maven/Gradle coordinates, or rebuild the dependency
from source targeting the correct Java version, before running OpenRewrite or upgrading the parent POM.

### Spring Boot BOM version override staleness

When using the Spring Boot parent POM (or BOM import), **do not override managed dependency versions
with explicit `<properties>` entries** unless you have a specific reason. If you do, those overrides
become silently stale after upgrading the parent version. [VERIFIED — Baeldung, spring.io, blog.ibtisam-iq.com]

```xml
<!-- Stale override — was pinned to fix a CVE in Spring Boot 2.x; now holds back a newer version -->
<properties>
  <jackson.version>2.13.0</jackson.version>  <!-- REMOVE after upgrading to Spring Boot 3.x -->
</properties>
```

Fix: after bumping the Spring Boot parent version, audit all `<properties>` version overrides. If
the BOM's managed version now satisfies the original reason for the pin, remove the override. Maven
applies overrides silently — it does not warn you when a BOM catches up to your pin.

---

## GREEN — Migrates Cleanly

| Component | Notes |
|---|---|
| `@RestController`, `@RequestMapping`, `@GetMapping` | No changes |
| Spring Data JPA repositories | No changes to interface authoring |
| `@Autowired` / constructor injection | No changes |
| SLF4J / Logback | No changes; `logback-spring.xml` still works |
| JUnit 5 (`@Test`, `@SpringBootTest`) | No changes |
| `@ConfigurationProperties` | No changes to binding model |
| `@Scheduled` / `@Async` | No changes |
| Jackson `ObjectMapper` / `@JsonProperty` | No changes to annotation model |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM Spring Boot 2.x → 3.x (Java 17 required)

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `javax.*` → `jakarta.*` namespace | Jakarta EE 9+: all `javax.persistence`, `javax.servlet`, `javax.validation` packages renamed to `jakarta.*`. Mass import replacement needed. | M | MEDIUM — missed imports compile but fail at runtime |
| `WebSecurityConfigurerAdapter` | Removed in Spring Security 6. Replace with `SecurityFilterChain` bean + `@Bean` method. | M | HIGH — app fails to start |
| `authorizeRequests()` | Deprecated; replace with `authorizeHttpRequests()`. Old method still works in 5.x but removed in 6.x. | S | HIGH |
| `@EnableWebSecurity` behavior | No longer implies `@Configuration` — add `@Configuration` explicitly. | S | HIGH — beans not loaded |
| Spring Data `Page` / `Pageable` | No breaking changes; `findAll(Pageable)` still works. | — | LOW |
| `spring.datasource.*` connection pool | Defaults changed in Spring Boot 3.x (HikariCP); verify pool size config. | S | LOW |

### Migrating Java 11 → 17

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Strong encapsulation of JDK internals | `--add-opens` flags required for frameworks using reflection on JDK internals (some older Hibernate, Spring versions). | S | HIGH — `InaccessibleObjectException` at startup |
| Sealed classes / records | New language features; no migration needed unless source uses reserved keywords (`sealed`, `record`, `permits`). | S | LOW |
| GC defaults | G1GC still default; ZGC improved. No migration unless GC flags are hardcoded. | — | LOW |

### Migrating Java 17 → 21

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Virtual threads (Project Loom) | Java 21 GA; `Thread.ofVirtual()`. Optional adoption; no migration needed unless opting in via Spring Boot 3.2+ virtual thread executor. | S | LOW |
| Pattern matching `switch` | GA in Java 21; no migration needed. | — | LOW |
| Sequenced collections | New `SequencedCollection`, `SequencedMap` interfaces in `java.util`. Most usages transparent. | S | LOW |

---

## RED — Will Break

### Package / dependency compatibility

| Package | Common upgrade notes |
|---|---|
| `spring-boot-starter-*` | Spring Boot 3.x requires Spring 6, which requires Java 17. All `2.x` starters must be bumped to `3.x`. |
| `hibernate-core` | Hibernate 6 (bundled with Spring Boot 3) uses Jakarta namespace; `HibernateJpaVendorAdapter` config changed. |
| `spring-security-*` | Spring Security 5 → 6 has `WebSecurityConfigurerAdapter` removal (see YELLOW). |
| `io.micrometer` | Micrometer 1.10+ (Spring Boot 3) has tag→attribute rename in some meters. |
| `springdoc-openapi` | v1.x is Spring Boot 2 only; v2.x required for Spring Boot 3. |
| Community libraries — MapStruct, Flyway, Testcontainers, Lombok, Ehcache | **OpenRewrite recipes only cover well-known Spring/Jakarta migrations.** Libraries without dedicated recipes — Ehcache 2→3, some OpenAPI generator configurations, custom third-party libraries — require manual migration. [VERIFIED — openrewrite docs, dev.to/verhasi] After each hop, manually verify and bump: `mapstruct` + `mapstruct-processor`; `flyway-core`; `testcontainers-*`; `lombok`; any in-house library. |

### Removed APIs

| Removed | Replacement |
|---|---|
| `javax.persistence.*` | `jakarta.persistence.*` |
| `javax.servlet.*` | `jakarta.servlet.*` |
| `javax.validation.*` | `jakarta.validation.*` |
| `WebSecurityConfigurerAdapter` | `SecurityFilterChain` bean |
| `authorizeRequests()` | `authorizeHttpRequests()` |

---

## replacement_mappings

| Old | New | Scope |
|---|---|---|
| `javax.persistence` | `jakarta.persistence` | All `.java` imports |
| `javax.servlet` | `jakarta.servlet` | All `.java` imports |
| `javax.validation` | `jakarta.validation` | All `.java` imports |
| `javax.annotation` | `jakarta.annotation` | All `.java` imports |
| `springdoc-openapi-ui` (v1) | `springdoc-openapi-starter-webmvc-ui` (v2) | `pom.xml` / `build.gradle` |
| `WebSecurityConfigurerAdapter` | `SecurityFilterChain` bean | Security config class |

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `javax.persistence` | Spring Boot 3 / Jakarta EE 9 | Namespace removed | Replace all `javax.persistence` imports with `jakarta.persistence` |
| `javax.servlet` | Spring Boot 3 | Namespace removed | Replace with `jakarta.servlet` |
| `WebSecurityConfigurerAdapter` | Spring Security 6 | Class removed | Replace with `SecurityFilterChain` bean |
| `authorizeRequests()` | Spring Security 6 | Method removed | Replace with `authorizeHttpRequests()` |
| `@EnableWebSecurity` | Spring Security 6 | No longer implies `@Configuration` | Add explicit `@Configuration` annotation |
| `--add-opens` | Java 17 strong encapsulation | JDK internals sealed | Audit JVM args; update affected library versions |
| `Thread.sleep` | Java 21+ | Not removed; virtual threads change thread model | Review for blocking I/O in virtual thread contexts |

---

## Migration Procedure

### Step 1 — Update Java version in pom.xml / build.gradle
```xml
<!-- pom.xml -->
<java.version>17</java.version>  <!-- or 21 -->
```

### Step 2 — Update Spring Boot parent version
```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>3.3.x</version>
</parent>
```

### Step 3 — Mass import replacement (javax → jakarta)
```bash
find src -name "*.java" -exec sed -i \
  's/import javax\.persistence\./import jakarta.persistence./g;
   s/import javax\.servlet\./import jakarta.servlet./g;
   s/import javax\.validation\./import jakarta.validation./g' {} +
```
Verify with: `grep -r "import javax\." src/` (should return empty)

### Step 4 — Fix security config
Replace `WebSecurityConfigurerAdapter` subclass with `@Bean SecurityFilterChain` method pattern.

### Step 5 — Build and test
```bash
# Run compile-only FIRST — surfaces Java source errors cleanly without test noise
mvn compile   # or: ./gradlew compileJava

# Then full build with tests
mvn clean verify  # or ./gradlew build
```

> **Build order tip:** `mvn compile` isolates Java compiler errors from test failures and
> dependency resolution errors. Fix compilation errors first, then run `mvn verify` to surface
> integration test and plugin failures.

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| U1 | Java + Spring Boot version bump | Update pom/gradle, resolve startup failures |
| U2 | javax → jakarta namespace | Mass import replacement, compile fixes |
| U3 | Security config migration | WebSecurityConfigurerAdapter → SecurityFilterChain |
| U4 | Third-party deps | springdoc v2, Hibernate 6, Micrometer 1.10+ |
| U5 | Behavioral regressions | Fix test failures from changed defaults |

---

## Post-hop audit checklist

Run after each Spring Boot or Java version hop before committing:

```
[ ] mvn compile (or ./gradlew compileJava) → fix source-level Java errors first
[ ] mvn verify (or ./gradlew build) → run full lifecycle including tests
[ ] Audit all <properties> version overrides in pom.xml:
      → Does the upgraded Spring Boot BOM now manage this version adequately?
      → If yes: remove the override (let BOM manage it)
      → If no: document why the explicit pin is still needed
[ ] Check <systemPath> JAR references — verify bytecode major version matches new JVM
      (javap -verbose ClassName.class | grep 'major version')
[ ] Manually bump community libraries NOT covered by OpenRewrite:
      [ ] mapstruct + mapstruct-processor (must match versions)
      [ ] flyway-core
      [ ] testcontainers-* family
      [ ] lombok
      [ ] springdoc-openapi (v1.x → v2.x for Spring Boot 3)
      [ ] Ehcache, custom or proprietary libraries
[ ] grep -r "import javax\." src/ → verify zero remaining javax imports after jakarta migration
[ ] Verify spring.datasource.* pool config matches new HikariCP defaults (Spring Boot 3+)
```
