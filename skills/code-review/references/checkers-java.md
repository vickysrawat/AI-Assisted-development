# Coverity Checkers — Java / Spring Boot / JPA

## TAINTED_* — Data Flow (Java)

| Pattern | Checker | Example |
|---------|---------|---------|
| Request param concatenated into JPQL/SQL | TAINTED_SQL | `em.createQuery("FROM User WHERE name='" + name + "'")` |
| Request value passed to `Runtime.exec` / `ProcessBuilder` | TAINTED_CMD | `Runtime.getRuntime().exec("sh -c " + cmd)` |
| Request value written unescaped to an HTML response/template | TAINTED_HTML | reflected value in a Thymeleaf `th:utext` |
| Request value used in `Paths.get` / `new File(...)` without validation | TAINTED_PATH | `new File(baseDir, request.getParameter("f"))` |
| Request value passed to `RestTemplate`/`WebClient` URL | TAINTED_SSRF | `restTemplate.getForObject(userUrl, ...)` |
| Request value deserialized via Jackson `@JsonTypeInfo`/default typing | TAINTED_DESERIALIZE | polymorphic deserialization of untrusted JSON |
| Request value passed to `sendRedirect`/`RedirectView` | TAINTED_REDIRECT | open redirect |

## NULL_RETURNS — Java Patterns

| Pattern | Risk |
|---------|------|
| `Optional.get()` without `isPresent()`/`orElse` | NoSuchElementException |
| Repository `findById(..)` result used without `Optional` handling | NPE in production |
| Map `.get(key)` result dereferenced without null check | NPE |
| `@Autowired` field used in a constructor (injected after construction) | NPE during init |
| Method declared `@Nullable` dereferenced without check | NPE |

## RESOURCE_LEAK — Java Patterns

| Object | Safe pattern |
|--------|-------------|
| `InputStream` / `OutputStream` | try-with-resources `try (var in = ...)` |
| `Connection` / `Statement` / `ResultSet` (raw JDBC) | try-with-resources |
| `Reader` / `Writer` | try-with-resources |
| Manually opened `EntityManager` | close in finally / try-with-resources |
| Reactive `Disposable` (Reactor) | dispose on teardown |

## CONTROL_FLOW & QUALITY — Java

- **DEADCODE / UNREACHABLE**: code after `return`/`throw`; conditions always true/false
- **MISSING_BREAK**: `switch` case fall-through without `// fallthrough`
- **BAD_COMPARE**: comparing objects (especially `String`, boxed numbers) with `==` instead of `.equals()`
- **SELF_ASSIGN**: `this.x = x` typo where field shadows itself incorrectly
- **CHECKED_RETURN**: ignoring the boolean/return of methods that signal outcome
- **SWALLOWED_EXC**: empty `catch` block or catch-and-continue hiding a critical error
- **INCOMPATIBLE_CAST**: unchecked downcast likely to throw `ClassCastException`

## CONCURRENCY — Java

- **RACE_CONDITION**: shared mutable state (non-`final`, non-`volatile` fields, singleton beans with mutable state) accessed from multiple threads without synchronization
- **DEADLOCK**: nested `synchronized` blocks acquired in inconsistent order
- **THREAD_LEAKED**: `ExecutorService` created but never `shutdown()`; raw `new Thread()` not managed
- **BLOCKING_IN_REACTIVE**: blocking call (`.block()`, JDBC) inside a reactive (`Mono`/`Flux`) pipeline
- Spring singleton beans must be stateless — flag mutable instance fields on `@Service`/`@Component`

## SPRING-SPECIFIC API MISUSE

- `@Transactional` on a non-public method, or self-invocation bypassing the proxy → transaction not applied
- `@Transactional` method that swallows exceptions → rollback silently skipped
- Field injection (`@Autowired` on a field) instead of constructor injection
- Missing `@Valid` on a request body that has Bean Validation annotations
- `findAll()` without pagination on a large table → unbounded result set
- N+1 query: lazy association accessed in a loop without a fetch join

## MISSING_DECISION_COMMENT — Java

Flag complex logic lacking a `// DECISION:` comment: custom retry/backoff, caching
policy, non-obvious data-structure choice (e.g. `ConcurrentHashMap` vs synchronized
map), or a pattern that diverges from the obvious path. Use the standard finding
format from `checkers.md` §2k. Do not flag trivial code or standard CRUD.
