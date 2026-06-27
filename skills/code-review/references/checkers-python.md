# Coverity Checkers — Python (FastAPI / Django / Flask)

## TAINTED_* — Data Flow (Python)

| Pattern | Checker | Example |
|---------|---------|---------|
| Request value formatted into raw SQL | TAINTED_SQL | `cursor.execute(f"SELECT * FROM u WHERE n='{name}'")` |
| Request value passed to `os.system`/`subprocess` with `shell=True` | TAINTED_CMD | `subprocess.run(f"ls {path}", shell=True)` |
| Request value rendered unescaped in a template | TAINTED_HTML | `render_template_string(user_input)` / `mark_safe(user_input)` |
| Request value used in `open()`/`os.path.join` without validation | TAINTED_PATH | `open(os.path.join(base, request.args["f"]))` |
| Request value passed to `requests`/`httpx` URL | TAINTED_SSRF | `requests.get(user_url)` |
| Request value passed to `pickle.loads`/`yaml.load` (unsafe) | TAINTED_DESERIALIZE | `pickle.loads(body)` |
| Request value passed to a redirect | TAINTED_REDIRECT | `redirect(request.args["next"])` open redirect |
| Request value passed to `eval`/`exec` | TAINTED_CODE | arbitrary code execution |

## NULL / NONE — Python Patterns

| Pattern | Risk |
|---------|------|
| `dict.get(key)` result used without `None` check | AttributeError on None |
| ORM `.first()` / `.get()` result used without check | AttributeError on None |
| Function that may `return None` dereferenced directly | AttributeError |
| `next(iter, None)` result used without check | |
| Optional attribute accessed without guard (`x.attr` where `x` may be None) | |

## RESOURCE_LEAK — Python Patterns

| Object | Safe pattern |
|--------|-------------|
| File handles | `with open(...) as f:` context manager |
| DB connections/cursors (raw) | `with` context manager / explicit close in finally |
| `requests.Session` | reuse + close, or `with` |
| Async resources (aiohttp session, async db) | `async with` |
| Locks (`threading.Lock`) | `with lock:` not manual acquire/release |

## CONTROL_FLOW & QUALITY — Python

- **DEADCODE / UNREACHABLE**: code after `return`/`raise`; conditions always true/false
- **BARE_EXCEPT**: `except:` or `except Exception:` that swallows and continues
- **MUTABLE_DEFAULT**: mutable default argument (`def f(x=[])`) — shared across calls
- **SELF_ASSIGN**: `x = x` no-op assignments
- **CHECKED_RETURN**: ignoring a return value that signals an outcome
- **SWALLOWED_EXC**: `except ...: pass` hiding a critical error
- **TYPE_CONFUSION**: comparing with `==` where `is`/`is None` is intended, or vice versa

## CONCURRENCY — Python

- **RACE_CONDITION**: module-level mutable state mutated from concurrent async handlers or threads
- **BLOCKING_IN_ASYNC**: blocking call (sync I/O, `time.sleep`, sync DB driver) inside an `async def` handler
- **MISSING_AWAIT**: coroutine called without `await` (returns a coroutine object, never runs)
- **THREAD_LEAKED**: `Thread`/`ThreadPoolExecutor` created but never joined/shutdown

## FRAMEWORK-SPECIFIC API MISUSE

**FastAPI**
- Sync `def` path operation doing blocking I/O (should be `async def` or run in threadpool)
- Missing `response_model` allowing internal fields to leak
- Mutable global used as request-scoped state

**Django**
- `.raw()` / `.extra()` with string interpolation → SQL injection
- `QuerySet` evaluated in a loop causing N+1 (use `select_related`/`prefetch_related`)
- `DEBUG = True` reachable in production settings
- Missing `@permission_classes` / unauthenticated view exposing data
- `csrf_exempt` on a state-changing view

**Flask**
- `debug=True` in `app.run()` committed
- Route handler doing blocking work without a task queue
- `render_template_string` on user input (SSTI)

## MISSING_DECISION_COMMENT — Python

Flag complex logic lacking a `# DECISION:` comment: custom retry/backoff, caching
policy, non-obvious data-structure choice, or a pattern diverging from the obvious
path. Use the standard finding format from `checkers.md` §2k (with `#` comments).
Do not flag trivial code or standard CRUD/ORM patterns.
