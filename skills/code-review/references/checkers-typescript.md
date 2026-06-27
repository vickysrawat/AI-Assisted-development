# Coverity Checkers — TypeScript / Angular / Node.js

## TAINTED_* — Data Flow (TypeScript / Node.js)

| Pattern | Checker | Example |
|---------|---------|---------|
| `req.body.x` / `req.query.x` concatenated into SQL | TAINTED_SQL | `` `SELECT * FROM t WHERE id=${req.query.id}` `` |
| `req.body` passed to `child_process.exec` | TAINTED_CMD | `exec('ls ' + req.body.dir)` |
| `req.query` written to `innerHTML` / `res.send` | TAINTED_HTML | `res.send('<p>' + req.query.name + '</p>')` |
| `req.params` used in `path.join` without validation | TAINTED_PATH | `path.join(__dirname, req.params.file)` |
| `req.body.url` passed to `fetch` / `axios` | TAINTED_SSRF | `axios.get(req.body.url)` |
| `req.body` passed to `JSON.parse` then used as type | TAINTED_DESERIALIZE | Prototype pollution via `JSON.parse` |
| `@Input()` value bound to `[href]` or `[src]` without sanitization | TAINTED_HTML | Angular template binding |

## NULL_RETURNS — TypeScript Patterns

| Pattern | Risk |
|---------|------|
| `Array.find()` result used without `?? / if` check | TypeError at runtime |
| `document.getElementById()` used without null check | |
| `Map.get()` result used directly | |
| Optional chaining missing: `obj.prop.sub` when `prop` can be undefined | |
| Non-null assertion `!` on value that can be null at runtime | |
| `req.headers['x-custom']` used as string without type guard | |

## RESOURCE_LEAK — Node.js Patterns

| Object | Safe pattern |
|--------|-------------|
| `fs.open()` file descriptor | Close in `finally` or use `fs.promises` with `using` |
| Database connection from pool | Always release in `finally` |
| `ReadStream` / `WriteStream` | Pipe with error handling; close on error |
| `EventEmitter` listener | Remove with `removeListener` in cleanup |
| `setInterval` handle | Store reference; call `clearInterval` on cleanup |
| Worker thread | Terminate on error paths |

## RESOURCE_LEAK — Angular Patterns

| Object | Safe pattern |
|--------|-------------|
| `Observable` subscription | Store in `Subscription`; call `unsubscribe()` in `ngOnDestroy` |
| `Subject` / `BehaviorSubject` | Call `complete()` in `ngOnDestroy` |
| DOM event listener added in component | Remove in `ngOnDestroy` |
| `setInterval` in component | `clearInterval` in `ngOnDestroy` |
| Router events subscription | Unsubscribe in `ngOnDestroy` |

## CHECKED_RETURN — TypeScript / Node.js

| Ignored return | Risk |
|----------------|------|
| `Promise` not awaited in async function | Silent failure |
| `fs.unlink()` callback error ignored | Silent file operation failure |
| `array.splice()` return value ignored when length needed | |
| `parseInt()` result not checked for `NaN` | |
| `JSON.parse()` without try/catch | SyntaxError crash |

## CONCURRENCY — Node.js Patterns

| Pattern | Checker |
|---------|---------|
| Module-level mutable variable modified in concurrent request handlers | RACE_CONDITION |
| `await` inside `for` loop instead of `Promise.all` / `for...of` with `await` | THREAD_LEAKED |
| `async` function called without `await` inside Express middleware | THREAD_LEAKED |
| Error in async `EventEmitter` handler not caught — crashes process | MISSING_THROW |
| Missing `await` on `db.query()` — result undefined before use | UNINIT |

## CONTROL FLOW — TypeScript / Angular

| Pattern | Checker |
|---------|---------|
| `switch` on string/enum with no `default` case | MISSING_BREAK |
| Observable `pipe()` chain with `.subscribe()` inside `.subscribe()` | DEADCODE |
| `if (x !== null && x !== undefined)` followed by `x!.prop` — double check then force cast | REDUNDANT_NULL_CHECK |
| `async ngOnInit()` without error handling — Angular lifecycle error swallowed | SWALLOWED_EXC |
| `ChangeDetectorRef.detectChanges()` called after component destroyed | DEADCODE |

## Angular-Specific Checkers

| Pattern | Checker | Detail |
|---------|---------|--------|
| `DomSanitizer.bypassSecurityTrustHtml(userInput)` | TAINTED_HTML | Explicit XSS risk |
| `innerHTML` binding with user-controlled data | TAINTED_HTML | Template injection |
| `[href]="userInput"` without sanitization | TAINTED_REDIRECT | `javascript:` URL injection |
| `HttpClient` observable not unsubscribed on component destroy | RESOURCE_LEAK | Memory leak |
| `ChangeDetectionStrategy.OnPush` with mutable input object mutation | LOGIC_ERROR | View not updated |
| `trackBy` missing in `*ngFor` with large lists | PERF | Not a bug but flagged |

## Prototype Pollution (Node.js)

Flag any pattern where user-controlled keys are used to set properties on objects:
```javascript
// TAINTED_DESERIALIZE — prototype pollution
const obj = {};
obj[req.body.key] = req.body.value;   // if key is "__proto__"
```

Flag: `merge()`, `extend()`, `Object.assign({}, untrustedObject)` where the source is user-controlled.
