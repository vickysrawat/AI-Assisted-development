# Code Review Skill — Checker Categories
_Load in Step 0e before beginning analysis._

---

## 2. Checker Categories

### 2a. Data Flow — Tainted Data (TAINTED_*)

Track data from **untrusted sources** to **dangerous sinks** across function boundaries.

**Sources** (treat as tainted):
- HTTP request parameters, headers, cookies, body (`Request.Query`, `req.body`, `HttpContext`, `@Input()`)
- Database query results used as further queries
- File system reads used as commands
- Environment variables used in SQL/commands
- User-uploaded file names and content

**Sinks** (dangerous if tainted data reaches):
- SQL query strings → `TAINTED_SQL`
- OS command strings → `TAINTED_CMD`
- HTML/DOM output → `TAINTED_HTML`
- File paths → `TAINTED_PATH`
- Redirect URLs → `TAINTED_REDIRECT`
- Deserializer input → `TAINTED_DESERIALIZE`
- HTTP requests (SSRF) → `TAINTED_SSRF`

**How to trace**:
1. Identify the source (entry point receiving untrusted data)
2. Follow the data through assignments, method calls, and returns
3. Report when tainted data reaches a sink without sanitization
4. Show the full event path: `Source → Transform? → Sink`

**Example finding**:
```
CID 1001 | TAINTED_SQL | High
Function: UserController.Search()
Path:
  Event 1 [Source]    UserController.cs:14  — query = Request.Query["q"]
  Event 2 [Transfer]  SearchService.cs:31   — result = repo.Find(query)
  Event 3 [Sink]      UserRepository.cs:87  — cmd.CommandText = "SELECT * FROM Users WHERE name='" + query + "'"
Fix: Use parameterised query — cmd.Parameters.AddWithValue("@name", query)
```

---

### 2b. Null / Forward Null (NULL_RETURNS, FORWARD_NULL, REVERSE_NULL)

- **NULL_RETURNS**: method can return null but return value is dereferenced without null check
- **FORWARD_NULL**: variable assigned null on one path, then used without check on another path
- **REVERSE_NULL**: null check done after the value is already used

**Check for**:
- `.FirstOrDefault()` result used without null check
- `as` cast result used without null check
- Method return values dereferenced without null guard
- Optional chaining (`?.`) missing where it should be present
- `null!` suppression hiding real null risks

---

### 2c. Resource Leaks (RESOURCE_LEAK)

Track objects implementing `IDisposable` (C#) or requiring explicit close/destroy (JS/Node):

- **C#**: `SqlConnection`, `SqlCommand`, `StreamReader`, `FileStream`, `HttpClient` instances not in `using` blocks
- **Node.js**: database connections, file handles (`fs.open`), streams not closed on error paths
- **Angular**: Observable subscriptions not unsubscribed in `ngOnDestroy`

Report when:
- Object is created but `Dispose()` / `close()` is not called on all exit paths
- Exception path exits without releasing the resource
- Object is assigned in a loop without release between iterations

---

### 2d. Memory & Buffer Safety (BUFFER_SIZE, OVERRUN, UNDERRUN)

Primarily relevant for C# unsafe code and interop:

- Array index access without bounds check when index is user-controlled
- `stackalloc` with user-controlled size
- P/Invoke buffer size mismatches
- `Marshal.Copy` with incorrect length
- `Span<T>` / `Memory<T>` slice with unchecked index
- JavaScript typed array access without length validation

---

### 2e. Control Flow (DEADCODE, UNREACHABLE, MISSING_BREAK, INFINITE_LOOP)

- **DEADCODE**: condition that is always true/false, making a branch unreachable
- **UNREACHABLE**: code after `return`, `throw`, `break`, or `continue`
- **MISSING_BREAK**: `switch` case falls through to next case without explicit `// fallthrough` comment
- **INFINITE_LOOP**: loop with no reachable exit condition
- **USELESS_CONDITION**: `if (x == null && x.Property)` — second condition unreachable

---

### 2f. Uninitialized Variables (UNINIT, UNINIT_CTOR)

- **UNINIT**: variable read before being assigned on some code path
- **UNINIT_CTOR**: class field not initialized in all constructors

Check for:
- Variables declared but only assigned inside `if` blocks that may not execute
- `out` parameters not assigned on all code paths
- Struct fields left uninitialized
- C# nullable reference types used without initialization

---

### 2g. Error Handling (CHECKED_RETURN, SWALLOWED_EXC, MISSING_THROW)

- **CHECKED_RETURN**: return value of a method that signals errors is silently ignored
  - `int.TryParse()` called but bool result ignored
  - `File.Delete()` result unchecked
  - `Task` returned from async method not awaited
- **SWALLOWED_EXC**: `catch` block that does nothing (empty catch or log-and-continue hiding critical error)
- **MISSING_THROW**: exception caught, partially handled, but not re-thrown when it should be

---

### 2h. Concurrency (DEADLOCK, RACE_CONDITION, THREAD_LEAKED, LOCK_EVASION)

- **DEADLOCK**: two locks acquired in inconsistent order across threads
- **RACE_CONDITION**: shared mutable state accessed without synchronisation
- **THREAD_LEAKED**: `Thread` or `Task` created but never awaited or tracked
- **LOCK_EVASION**: lock acquired but released on only some exit paths

**C# specific**:
- `static` mutable fields accessed from async methods without `lock` or `Interlocked`
- `async void` methods (fire-and-forget with unhandled exceptions)
- `ConfigureAwait(false)` missing in library code causing deadlocks on sync context

**Node.js specific**:
- Shared mutable module-level state modified in concurrent async handlers
- Missing `await` on async operations inside loops (`for` instead of `for...of` with `await`)

---

### 2i. API Misuse (BAD_COMPARE, SIZEOF_MISMATCH, INCOMPATIBLE_CAST, SLEEP)

- **BAD_COMPARE**: comparing value types with `==` where reference equality is used (e.g. comparing `string` literals with `==` in Java-influenced code, comparing nullable value types incorrectly)
- **INCOMPATIBLE_CAST**: cast between unrelated types likely to throw `InvalidCastException`
- **SIZEOF_MISMATCH**: `Marshal.SizeOf` used on wrong type, or array length mismatch in interop
- **SLEEP**: `Thread.Sleep()` in async context (should use `Task.Delay`)
- **AWAIT_IN_LOCK**: `await` inside a `lock` block — illegal in C#
- **LINQ_SIDE_EFFECTS**: LINQ query with side effects in predicates executed multiple times

---

### 2j. Code Quality (COPY_PASTE_ERROR, SELF_ASSIGN, LOGIC_ERROR)

- **COPY_PASTE_ERROR**: two similar code blocks where one variable name differs in a suspicious way
- **SELF_ASSIGN**: `x = x` assignments (property getter returning backing field with wrong name)
- **LOGIC_ERROR**: operator precedence issue creating unintended evaluation order
- **REDUNDANT_NULL_CHECK**: null check on a value that cannot be null at that point
- **NEGATIVE_RETURNS**: method documented to return non-negative but can return negative on some paths

### 2k. Decision Transparency (MISSING_DECISION_COMMENT)

Flag complex logic blocks that lack a `// DECISION:` comment documenting why the approach was chosen.

Apply this check when code contains any of the following without a preceding decision comment:

- A non-obvious algorithm (custom sort, retry strategy, backoff calculation, caching policy)
- A specific data structure choice where alternatives existed (e.g. `Dictionary` vs `List`, `Subject` vs `BehaviorSubject`, `ConcurrentQueue` vs `Channel`)
- An architectural pattern selection that diverges from the obvious path (mediator vs direct call, push vs pull, polling vs websocket)
- A workaround or constraint-driven implementation that would look wrong to a future developer

**Finding format:**
```
CID <id> | MISSING_DECISION_COMMENT | Low
File: <path>
Function: <class.method()>
Impact: Future developer cannot determine why this approach was chosen over simpler alternatives,
        increasing risk of uninformed refactoring.

Vulnerable Code:
  <the complex block without a decision comment>

Fix:
  // DECISION: <what is being decided>
  // Options considered:
  //   A) <alternative> — rejected: <reason>
  //   B) <chosen approach> — chosen: <reason>
  <original code unchanged>
```

Do not flag: trivial or self-evident code, standard CRUD patterns, or any block already preceded by a `// DECISION:` comment.

---
