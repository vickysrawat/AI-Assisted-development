# Tech Spec Overlay — React + Python FastAPI (Entra ID auth)
# Stack: react + python in all_stacks. No Node.js BFF layer.
#
# Pattern: React component → custom hook → HTTP service (axios + MSAL token) →
#          FastAPI router → service → repository → DB
# Layer contract: React calls FastAPI directly · MSAL supplies Bearer token ·
#                 FastAPI validates with Azure AD JWKS · no Node.js intermediary
# Auth assumption: MSAL bootstrap (src/auth/) and FastAPI get_current_user dependency
#   exist from initial project setup.
#   Initial setup guide: skills/icea-feature/references/entra-auth-reference.md
#
# Path note: Vite project layout (src/) for React; app/ for FastAPI.
# Adjust to match your project's actual directory structure.
# Last refreshed: 2026-10-20

---

## DO NOT rules (apply to every file in this spec)

> Rules enforced by rule files (active on every file edit — not duplicated here):
> `react-ecosystem-rules.md § Out of bounds` — React.FC ban, import React ban, success:boolean ban
> `auth-rules.md § Microsoft Entra ID (MSAL)` — idTokenClaims.roles, acquireTokenRedirect, loadingRoles guard
> Only stack-combination-specific rules appear below.

- DO NOT use trailing-slash collection routes (`"/"`) — use `""` for collection routes
- DO NOT put business logic in the FastAPI router — delegate to the service only
- DO NOT build SQL by f-string or `%`-format — always ORM or parameterised `text()`
- DO NOT use `RETURNING id` in raw SQL — ORM `flush()` assigns `obj.id` without committing
- DO NOT call `commit()` in the repository — the service commits after all writes in one transaction
- DO NOT return Pydantic schemas from the repository — return ORM model objects; the service maps them

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 1 | `src/components/{Feature}/{Feature}.tsx` | React | Add/modify component; role guard via `useAuth()` |
| 2 | `src/components/{Feature}/{Feature}.module.css` | React | Component-scoped styles |
| 3 | `src/hooks/use{Feature}.ts` | React | Custom hook — data fetching and state |
| 4 | `src/services/{feature}.service.ts` | React | HTTP service (axios + `getAccessToken`); `extractDetail` helper |
| 5 | `src/types/{feature}.types.ts` | React | TypeScript interfaces mirroring FastAPI schemas |
| 6 | `app/routers/{feature}.py` | FastAPI | Add/modify `APIRouter` endpoints; `require_any_role` dependency |
| 7 | `app/services/{feature}_service.py` | FastAPI | Business logic; raises `NotFoundError` / `ForbiddenError` |
| 8 | `app/schemas/{feature}_schema.py` | FastAPI | `{Feature}Item`, `{Feature}Request`, `{Feature}Created` |
| 9 | `app/repositories/{feature}_repository.py` | FastAPI | ORM-based DB access; returns ORM models |
| 10 | `app/models/{feature}.py` | FastAPI | SQLAlchemy ORM model *(if new table)* |
| 11 | `alembic/versions/{timestamp}_{feature}.py` | FastAPI | Migration `upgrade()` + `downgrade()` *(if schema changes)* |
| 12 | `app/dependencies.py` | FastAPI | Add `get_{feature}_service` factory |
| 13 | `tests/test_{feature}.py` | Tests | Service unit tests + router integration tests |

> Rows 10–11: include only when schema changes are required.
> AC tags: every code section below shows `# AC-Fx` on the relevant line.

### AC Traceability

Every AC must map to at least one file. Every file must satisfy at least one AC.
See base template AC Coverage Matrix.

---

## React Component — {Feature}.tsx

Role guard at component level. Keep JSX minimal — all data logic lives in the hook.

```tsx
import { useAuth } from '../auth/useAuth';
import { use{Feature} } from '../hooks/use{Feature}';
import styles from './{Feature}.module.css';

export function {Feature}() {
  const { isAuthorized, loadingRoles } = useAuth();
  const { items, isLoading, errorMessage } = use{Feature}();  // AC-F1

  if (loadingRoles) return <div role="status" aria-live="polite">Loading...</div>;
  if (!isAuthorized) return <div role="alert">Access denied.</div>;
  if (isLoading) return <div role="status" aria-live="polite">Loading...</div>;
  if (errorMessage) return <div role="alert" className={styles.error}>{errorMessage}</div>;

  return (
    <section aria-label="{Feature}">
      <ul className={styles.list}>
        {items.map(item => (
          <li key={item.id} className={styles.item}>{item.{field}}</li>
        ))}
      </ul>
    </section>
  );
}
```

**Template guidelines:**
- `loadingRoles` guard prevents "Access Denied" flash while the access token is being fetched
- ARIA: `aria-live="polite"` on dynamic regions; `aria-label` on icon-only buttons
- Never `dangerouslySetInnerHTML` with untrusted data
- CSS Modules for component-scoped styles — no global class mutations

---

## Custom Hook — use{Feature}.ts

Data fetching and state only. No auth logic here — the HTTP service handles token acquisition.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { {feature}Service } from '../services/{feature}.service';
import type { {Feature}Item, {Feature}Request } from '../types/{feature}.types';

export function use{Feature}() {
  const [items, setItems] = useState<{Feature}Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setItems(await {feature}Service.get{Feature}());  // AC-F1
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(async (payload: {Feature}Request): Promise<void> => {
    await {feature}Service.save{Feature}(payload);  // AC-F2
    await load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return { items, isLoading, errorMessage, refresh: load, save };
}
```

---

## HTTP Service — {feature}.service.ts (React)

Calls FastAPI directly. Acquires an MSAL access token before every request.

```typescript
import axios from 'axios';
import { getAccessToken } from '../auth/authService';
import type { {Feature}Item, {Feature}Request, {Feature}Created } from '../types/{feature}.types';

const BASE_URL = `${import.meta.env.VITE_API_URL}/{feature}`;

// FastAPI error detail is a string for custom errors, an array of objects for 422 validation failures.
function extractDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
  return 'An unexpected error occurred. Please try again.';
}

async function authHeaders(): Promise<{ Authorization: string }> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export const {feature}Service = {
  async get{Feature}(): Promise<{Feature}Item[]> {  // AC-F1
    try {
      const { data } = await axios.get<{Feature}Item[]>(BASE_URL, { headers: await authHeaders() });
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) throw new Error(extractDetail(err.response?.data?.detail));
      throw err;
    }
  },

  async save{Feature}(payload: {Feature}Request): Promise<{Feature}Created> {  // AC-F2
    try {
      const { data } = await axios.post<{Feature}Created>(BASE_URL, payload, { headers: await authHeaders() });
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) throw new Error(extractDetail(err.response?.data?.detail));
      throw err;
    }
  },
};
```

> `getAccessToken()` is defined in `src/auth/authService.ts`.
> It calls `msalInstance.acquireTokenSilent` and only redirects on `InteractionRequiredAuthError`.
> Initial setup: `skills/icea-feature/references/entra-auth-reference.md §5.5`.

---

## TypeScript Interfaces — {feature}.types.ts

Mirror FastAPI Pydantic schemas exactly. Use `readonly` to prevent accidental mutation.

```typescript
export interface {Feature}Item {
  readonly id: number;
  readonly {field}: string;
  readonly {optionalField}?: string;
}

export interface {Feature}Request {
  readonly {field}: string;
}

export interface {Feature}Created {
  readonly id: number;
  readonly {field}: string;
}
```

---

## FastAPI Router — app/routers/{feature}.py

Thin router: Pydantic validates input, service handles business logic.

```python
from typing import Annotated
from fastapi import APIRouter, Depends, status
from app.schemas.{feature}_schema import {Feature}Request, {Feature}Item, {Feature}Created
from app.services.{feature}_service import {Feature}Service
from app.dependencies import get_current_user, require_any_role, get_{feature}_service
from app.auth.models import UserContext

router = APIRouter(prefix="/{feature}", tags=["{Feature}"])

@router.get("", response_model=list[{Feature}Item])                                          # AC-F1
async def get_{feature}(
    service: Annotated[{Feature}Service, Depends(get_{feature}_service)],
    current_user: Annotated[UserContext, Depends(require_any_role)],
) -> list[{Feature}Item]:
    return await service.get_{feature}(user_id=current_user.oid)

@router.post("", response_model={Feature}Created, status_code=status.HTTP_201_CREATED)       # AC-F2
async def create_{feature}(
    request: {Feature}Request,
    service: Annotated[{Feature}Service, Depends(get_{feature}_service)],
    current_user: Annotated[UserContext, Depends(require_any_role)],
) -> {Feature}Created:
    return await service.create_{feature}(request, user_id=current_user.oid)
```

---

## FastAPI Dependencies — app/dependencies.py

> `get_current_user`, `require_any_role`, and `require_admin` are shared auth infrastructure.
> Do not duplicate per-feature — add only the feature-specific service factory.
> Initial setup: `skills/icea-feature/references/entra-auth-reference.md §4.3`.

```python
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_session
from app.repositories.{feature}_repository import {Feature}Repository
from app.services.{feature}_service import {Feature}Service

async def get_{feature}_service(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> {Feature}Service:
    repository = {Feature}Repository(db)
    return {Feature}Service(repository=repository, db=db)
```

---

## Pydantic Schemas — app/schemas/{feature}_schema.py

```python
from pydantic import BaseModel, Field, ConfigDict

class {Feature}Item(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    {field}: str
    {optional_field}: str | None = None

class {Feature}Request(BaseModel):
    {field}: str = Field(..., min_length=1, max_length=500)

class {Feature}Created(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    {field}: str
```

> `{Feature}Created` returns the created resource. Do not add `success: bool`.

---

## Service Layer — app/services/{feature}_service.py

Business logic only. No FastAPI imports — independently unit-testable.
Raises `NotFoundError` or `ForbiddenError` — never returns `None`.

```python
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.{feature}_schema import {Feature}Request, {Feature}Item, {Feature}Created
from app.repositories.{feature}_repository import {Feature}Repository
from app.exceptions import NotFoundError, ForbiddenError  # noqa: F401

class {Feature}Service:
    def __init__(self, repository: {Feature}Repository, db: AsyncSession) -> None:
        self._repository = repository
        self._db = db

    # STUB ADO-{ADO_ID} — swap when {criteria, e.g. DB table available}
    async def get_{feature}(self, user_id: str) -> list[{Feature}Item]:  # AC-F1
        return [{Feature}Item(id=1, {field}="Stub value")]

    async def create_{feature}(
        self, request: {Feature}Request, user_id: str,
    ) -> {Feature}Created:
        orm_obj = await self._repository.insert(                         # AC-F2
            {field}=request.{field}, user_id=user_id
        )
        await self._db.commit()
        return {Feature}Created.model_validate(orm_obj)
```

**Stub swap checklist:**
1. Search `# STUB ADO-{ADO_ID}` in the codebase
2. Replace stub with `orm_objects = await self._repository.get_by_user(user_id=user_id)`
3. Map: `return [{Feature}Item.model_validate(o) for o in orm_objects]`
4. Raise `NotFoundError` / `ForbiddenError` instead of `None` for missing/forbidden data
5. Update unit tests to mock the repository
6. Remove this comment block after swap

---

## Repository Layer — app/repositories/{feature}_repository.py

All DB access via SQLAlchemy ORM. Returns ORM models. Never calls `commit()`.

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.{feature} import {Feature} as {Feature}Model

class {Feature}Repository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_user(self, user_id: str) -> list[{Feature}Model]:  # AC-F1
        result = await self._db.execute(
            select({Feature}Model).where({Feature}Model.user_id == user_id)
        )
        return list(result.scalars().all())

    async def insert(self, {field}: str, user_id: str) -> {Feature}Model:  # AC-F2
        # DECISION: ORM add+flush — RETURNING id unsupported on SQL Server; flush assigns obj.id on any dialect.
        obj = {Feature}Model({field}={field}, user_id=user_id)
        self._db.add(obj)
        await self._db.flush()
        return obj
```

---

## Tests

### React — HTTP service unit tests (vitest)

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import * as authService from '../auth/authService';
import { {feature}Service } from './{feature}.service';

vi.mock('axios');
vi.mock('../auth/authService', () => ({ getAccessToken: vi.fn().mockResolvedValue('mock-token') }));

describe('{feature}Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('get{Feature} returns items on 200', async () => {  // AC-F1
    vi.mocked(axios.get).mockResolvedValue({ data: [{ id: 1, {field}: 'Test' }] });
    const result = await {feature}Service.get{Feature}();
    expect(result).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/{feature}'),
      expect.objectContaining({ headers: { Authorization: 'Bearer mock-token' } }),
    );
  });

  it('get{Feature} throws readable message on FastAPI 422', async () => {
    const axiosErr = { response: { data: { detail: [{ msg: 'Field required' }] } } };
    vi.mocked(axios.get).mockRejectedValue(axiosErr);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    await expect({feature}Service.get{Feature}()).rejects.toThrow('Field required');
  });
});
```

### FastAPI — router integration tests (httpx.AsyncClient)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock
from app.main import app
from app.dependencies import get_{feature}_service, require_any_role
from app.auth.models import UserContext

_MOCK_USER = UserContext(
    email="test@example.com", display_name="Test",
    roles=["Coordinator"], oid="user-1", expires_at=9_999_999_999,
)

@pytest.fixture
def authed_client():
    mock_service = AsyncMock()
    mock_service.get_{feature} = AsyncMock(return_value=[])
    app.dependency_overrides[get_{feature}_service] = lambda: mock_service
    app.dependency_overrides[require_any_role] = lambda: _MOCK_USER
    yield mock_service
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_{feature}_returns_200(authed_client):  # AC-F1
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/{feature}")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_get_{feature}_returns_401_without_token():
    app.dependency_overrides.clear()  # clear any leftover overrides
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/{feature}")
    assert response.status_code == 401
```

---

## API Changes

### React → FastAPI endpoints (direct — no Node.js BFF)

| Method | Route | Auth | Parameters | Response codes |
|---|---|---|---|---|
| GET | `/{feature}` | Bearer (MSAL access token) | — | 200, 401, 403, 404 |
| POST | `/{feature}` | Bearer (MSAL access token) | `{Feature}Request` body | 201, 400, 401, 403, 422 |

> FastAPI returns 422 for Pydantic validation failures; `detail` is `[{loc, msg, type}]`, not a string.
> `extractDetail()` in the HTTP service converts it to a human-readable string.
> CORS `allow_origins` must list React dev and production origins — no wildcard in production.
> CORS `allow_methods` must be kept in sync when new verbs are added.

### DB / persistence changes

{Describe any schema changes. If none: "No DB changes in this story."}

---

## Auth & Security

### React — MSAL token acquisition

`getAccessToken()` in `src/auth/authService.ts` calls `msalInstance.acquireTokenSilent`.
Only `InteractionRequiredAuthError` triggers a redirect — all other errors propagate.
Tokens stored in `sessionStorage` (never `localStorage`).
Role guard: `loadingRoles + isAuthorized` at component level (see `## React Component` above).

### FastAPI — JWT validation

`get_current_user` validates the Bearer token using JWKS cached from Azure AD (hourly refresh,
5-minute grace period, 503 after grace). Apply `require_any_role` or `require_admin` on every
protected endpoint. No endpoint is public by default.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.REACT_ORIGIN_DEV, settings.REACT_ORIGIN_PROD],
    allow_credentials=True,
    allow_methods=["GET", "POST"],   # keep in sync with router
    allow_headers=["Authorization", "Content-Type"],
)
```

Initial JWKS + auth setup: `skills/icea-feature/references/entra-auth-reference.md §4`.

### XSS analysis

| Location | Method | Safe? |
|---|---|---|
| React JSX `{value}` | Auto-escaped | ✅ Yes |
| React `dangerouslySetInnerHTML` | NOT escaped | ⚠ Flag any usage |
| FastAPI JSON response | Pydantic serialised | ✅ Yes |

---

## Reviewer Checklist

**Auth:**
- [ ] `loadingRoles` guard present in every component that checks `isAuthorized` — no flash
- [ ] HTTP service calls `getAccessToken()` before every request — no unauthenticated calls
- [ ] `getAccessToken()` only redirects on `InteractionRequiredAuthError`
- [ ] FastAPI router applies `require_any_role` or `require_admin` on every protected endpoint
- [ ] No endpoint accidentally public (missing `Depends` on a protected route)
- [ ] CORS `allow_origins` does not use `"*"` in production
- [ ] CORS `allow_methods` lists every HTTP verb in use

**React:**
- [ ] No `import React from 'react'` or `React.FC`
- [ ] No `dangerouslySetInnerHTML` unless explicitly reviewed
- [ ] CSS Modules used — no global class mutations

**Data access:**
- [ ] All DB queries use ORM or parameterised `text()` — no f-string / `%`-format SQL
- [ ] No `RETURNING id` in raw SQL — `flush()` used instead
- [ ] Repository returns ORM model objects, not Pydantic schemas
- [ ] `commit()` called in service, not repository

**Error handling:**
- [ ] `extractDetail()` handles both `string` and `array` FastAPI 422 detail
- [ ] Service raises `NotFoundError` / `ForbiddenError` — never returns `None`
- [ ] Both exception handlers registered in `app/main.py`

**DTOs:**
- [ ] No `success: boolean` in any response DTO — `{Feature}Created` returns the resource
- [ ] TypeScript interfaces mirror FastAPI schemas field-for-field

**Stub integrity:**
- [ ] Service stub marked `# STUB ADO-{ADO_ID}` with swap criteria
- [ ] Stub swap checklist (6-step) present in the service

**Regression:**
- [ ] Existing FastAPI routes unaffected
- [ ] Existing React routes/components unaffected
- [ ] CORS policy change (if any) does not break existing consumers
