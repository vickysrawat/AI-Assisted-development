# Parity Mapping: Python version upgrades

_Loaded when source = `python` for in-place same-stack version upgrades._

> **Scope — same-stack only.** Covers Python 3.9/3.10 → 3.11 → 3.12 → 3.13 upgrades,
> with framework-specific notes for FastAPI, Django, and Flask.
> Does NOT apply to Node.js → Python migrations (`nodejs-python.md`).

---

## Overview

Python's same-minor upgrades are generally low-disruption. The main work is:
1. Update `python_requires` in `pyproject.toml` / `setup.cfg`
2. Fix deprecated stdlib API usage
3. Validate third-party packages support the new version
4. Handle type system changes (PEP additions)

---

## Pre-hop blockers — check BEFORE upgrading

### C-extension wheel availability

Packages with compiled C extensions (`.so` / `.pyd` files) publish pre-built wheels per Python
version. If no wheel exists for your target Python version, `pip install` silently falls back to
building from source — which requires a compiler toolchain and may fail in CI. Check availability
before upgrading. [VERIFIED — realpython.com/python-wheels, packaging.python.org]

```bash
# Test whether a wheel exists for the target Python without installing it
pip install --only-binary :all: --dry-run <package>==<version>
# If this fails with "No matching distribution found" → no wheel for the current Python version

# Also check the wheel filename tags on PyPI:
# cp312-cp312-* = CPython 3.12 compiled extension (version-specific)
# py3-none-any   = pure Python (works on all versions)
```

Common C-extension packages to check: `numpy`, `Pillow`, `lxml`, `psycopg2-binary`,
`cryptography`, `scipy`, `pandas`, `pydantic` (v1 with C extensions), `greenlet`.

Fix: if a wheel is not yet available for the target Python version on PyPI, either wait for
the package maintainer to publish one, build from source (ensure compiler toolchain is available),
or pin to a version that does have a wheel.

### Backport package removal — stdlib promotions

Packages that backport stdlib features should be removed or made conditional when upgrading to
the Python version that ships them natively. Leaving them installed can cause shadowing or version
conflicts with the stdlib module. [VERIFIED — peps.python.org/pep-0680]

| Backport package | Replaced by | Since Python version |
|---|---|---|
| `tomli` | `tomllib` (stdlib) | 3.11 (PEP 680) |
| `importlib_metadata` | `importlib.metadata` (stdlib) | 3.9+ [INFERRED — verify before removing] |
| `zoneinfo` backport | `zoneinfo` (stdlib) | 3.9 [INFERRED — verify before removing] |
| `typing_extensions` (some features) | Built-in `typing` | varies by PEP — keep for multi-version compat |

**Safe removal pattern for `tomli`** (the most common case):
```python
# Instead of removing tomli outright (breaks Python < 3.11 support):
import sys
if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib  # keep as conditional dep
```

If you are dropping support for Python < 3.11 entirely, remove `tomli` from dependencies and use
`import tomllib` directly.

---

## GREEN — Migrates Cleanly

| Component | Notes |
|---|---|
| `async`/`await`, `asyncio` | No breaking changes across 3.9–3.13 |
| `pathlib.Path` | Stable |
| `dataclasses` | Stable |
| `typing` module basics (`Optional`, `Union`, `List`) | Stable; `X \| Y` syntax additive |
| Pydantic v2 models | Independent versioning; see RED below |
| SQLAlchemy 2.x | Stable across Python 3.9–3.13 |
| `pytest` | Independent versioning; check for each major |
| `requests` / `httpx` | Stable across versions |
| FastAPI route handlers (`@router.get`) | Stable |
| Django views, models, URLconf | Stable across Python versions |

---

## YELLOW — Needs Rework (version-specific)

### Migrating FROM Python 3.9 → 3.10

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `match`/`case` (structural pattern matching) | New syntax in 3.10. No migration; adoption is voluntary. | — | LOW |
| Union type syntax (`X \| Y`) | `int \| None` valid in 3.10+ type hints. Old `Optional[X]` still works. | — | LOW |
| `distutils` deprecation | Deprecated in 3.10; removed in 3.12. Any direct `distutils` usage must be replaced with `setuptools`. | S | HIGH if using distutils |

### Migrating FROM Python 3.10 → 3.11

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `tomllib` added | Built-in TOML parser. If source uses `tomli` (backport), remove the dependency. | S | LOW |
| `ExceptionGroup` | New type in 3.11. No migration needed. | — | LOW |
| `asyncio.get_event_loop()` deprecation | Raises `DeprecationWarning` in 3.10, error in 3.12 if no running loop. | S | MEDIUM |
| Performance improvements | Python 3.11 is significantly faster than 3.10 — benchmark-sensitive code may behave differently under profiling. | — | LOW |

### Migrating FROM Python 3.11 → 3.12

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| `distutils` removed | Fully removed in 3.12. Any `from distutils import ...` → `from setuptools import ...`. | S | HIGH — import error |
| `asyncio.get_event_loop()` | Raises `DeprecationWarning` when no running loop; errors in future. Replace with `asyncio.get_running_loop()`. | S | MEDIUM |
| `typing.TypeAlias` | `type X = Y` (soft keyword) available in 3.12. Old `TypeAlias` still works. | — | LOW |

### Migrating FROM Python 3.12 → 3.13

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| Experimental free-threaded Python (no GIL) | Optional build; standard CPython still has GIL. No migration unless opting into `--disable-gil` build. | — | LOW |
| Removal of long-deprecated typing aliases | `typing.List`, `typing.Dict`, etc. still exist but use `list`, `dict` built-in types directly. | S | LOW |

---

## Framework-specific notes

### FastAPI

| Concern | Notes |
|---|---|
| Pydantic v1 → v2 | FastAPI 0.100+ requires Pydantic v2. Major breaking change — model API, validators, config style all changed. Run `pydantic v1-to-v2` codemod. |
| `@app.on_event` (startup/shutdown) | Deprecated in FastAPI 0.103+; use `lifespan` context manager. |
| Response model inference | Minor changes in FastAPI 0.100+; explicit `response_model=` still works. |

### Django

| Concern | Notes |
|---|---|
| `django.utils.encoding.force_text` | Removed Django 4.0 → use `force_str`. |
| `ugettext` / `ugettext_lazy` | Removed Django 4.0 → use `gettext` / `gettext_lazy`. |
| `CONN_MAX_AGE` / database router | Minor behavioral change in Django 4.1+ with persistent connections. |
| Django 5.x Python minimum | Django 5.0 requires Python 3.10+; Django 5.1 requires Python 3.10+. |

### Flask

| Concern | Notes |
|---|---|
| Werkzeug 3.x | Flask 3.x requires Werkzeug 3.x — `Request.environ` and some routing internals changed. |
| `flask.helpers.get_debug_flag` | Removed Flask 2.3+. |

---

## RED — Will Break

| Component | Version | Impact |
|---|---|---|
| `distutils` imports | Removed Python 3.12 | `ImportError` at startup |
| `asyncio.get_event_loop()` without running loop | Error Python 3.12+ | `DeprecationWarning` → `RuntimeError` |
| Pydantic v1 with FastAPI 0.100+ | Incompatible | App startup failure or model validation errors |
| `ugettext` (Django) | Removed Django 4.0 | `ImportError` |
| `force_text` (Django) | Removed Django 4.0 | `ImportError` |

---

## replacement_mappings

| Old | New | Scope |
|---|---|---|
| `from distutils import ...` | `from setuptools import ...` | `setup.py`, build scripts |
| `asyncio.get_event_loop()` | `asyncio.get_running_loop()` | Async utility modules |
| `from django.utils.translation import ugettext` | `from django.utils.translation import gettext` | All Django translation imports |
| `from django.utils.encoding import force_text` | `from django.utils.encoding import force_str` | All encoding utility imports |
| `@app.on_event("startup")` | `@asynccontextmanager` lifespan | FastAPI main app setup |
| `Optional[X]` | `X \| None` (Python 3.10+) | Type annotations (optional migration) |

---

## behavioral_changes

Patterns for **Pass 3** codebase scan — grep each; flag files where found.

| Pattern | Changed In | Description | Required Action |
|---|---|---|---|
| `from distutils` | Python 3.12 removed | Module removed | Replace with `setuptools` equivalents |
| `asyncio.get_event_loop()` | Python 3.10 deprecated / 3.12 error | No running loop raises error | Replace with `asyncio.get_running_loop()` in async context |
| `ugettext` | Django 4.0 removed | Translation function removed | Replace with `gettext` / `gettext_lazy` |
| `force_text` | Django 4.0 removed | Encoding helper removed | Replace with `force_str` |
| `@app.on_event` | FastAPI deprecated | Startup/shutdown hook API deprecated | Migrate to `lifespan` context manager |
| `class Config:` | Pydantic v2 change | Pydantic v1 `Config` inner class syntax | Migrate to `model_config = ConfigDict(...)` |
| `@validator` | Pydantic v2 change | Old-style validator decorator | Replace with `@field_validator` + `@model_validator` |
| `typing.List[` | Python 3.9+ | Old generic alias | Use `list[...]` directly (optional migration) |
| `typing.Dict[` | Python 3.9+ | Old generic alias | Use `dict[...]` directly (optional migration) |
| `typing.Optional[` | Python 3.10+ | Old union form | Use `X \| None` (optional migration) |

---

## Migration Procedure

### Step 1 — Update Python version requirement
```toml
# pyproject.toml
[project]
requires-python = ">=3.12"
```

### Step 2 — Create new virtual environment
```bash
python3.12 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Step 3 — Run pip check
```bash
pip check  # detect dependency conflicts
```

### Step 4 — Fix distutils / deprecated API usage
```bash
grep -r "from distutils" .   # replace with setuptools
grep -r "asyncio.get_event_loop" .  # replace with get_running_loop
```

### Step 5 — Run tests
```bash
pytest --tb=short
```

---

## Recommended Slice Plan

| Slice | Name | Content |
|---|---|---|
| U1 | Python runtime bump | Update pyproject.toml, recreate venv, install deps |
| U2 | Stdlib removals | `distutils`, `asyncio` deprecations |
| U3 | Framework updates | FastAPI + Pydantic v2, Django 4→5, Flask + Werkzeug 3 |
| U4 | Type annotation modernization | Optional: `Optional[X]` → `X \| None`, `List` → `list` |
| U5 | Test suite verification | Fix behavioral regressions |

---

## Post-hop audit checklist

Run after switching to a new Python version:

```
[ ] pip install --only-binary :all: -r requirements.txt --dry-run
      → surfaces any C-extension package with no wheel for the target Python version
[ ] pip check → detect dependency conflicts (the Python equivalent of stale version pins)
[ ] Review backport packages that may now duplicate stdlib:
      [ ] tomli → remove if dropping Python < 3.11 support (stdlib tomllib since 3.11)
      [ ] importlib_metadata → verify if stdlib importlib.metadata now satisfies your usage
      [ ] zoneinfo backport → verify if stdlib zoneinfo satisfies your usage (Python 3.9+)
      [ ] typing_extensions → keep if supporting multiple Python versions; review per-feature
[ ] grep -r "from distutils" . → verify zero distutils imports (removed Python 3.12)
[ ] grep -r "asyncio.get_event_loop" . → replace with get_running_loop (error in 3.12+)
[ ] pytest --tb=short → run full test suite; fix behavioral regressions
[ ] Recreate virtual environment from scratch (do NOT reuse a venv from a different Python version)
[ ] Update python_requires in pyproject.toml / setup.cfg to the new minimum
[ ] Update CI pipeline Python version matrix (.github/workflows/*.yml, azure-pipelines.yml, etc.)
```
