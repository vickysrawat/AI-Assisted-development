# Tech Spec Overlay — Python FastAPI [+ optional Angular or React frontend]
# Stack: python in all_stacks.
# Primary reader: LLM (Claude). All conditional rules apply at generation time.
# Frontend sections: include when angular or react appears in all_stacks.
#   angular  = Angular standalone components (17+, Nx monorepo paths: apps/ + libs/)
#   react    = React functional components with hooks (19+, Vite paths: src/)
#   Mutually exclusive — never both.
# Framework: FastAPI only — async router + Pydantic v2 + SQLAlchemy async.
#
# Layer contract: repository returns ORM models · service maps to Pydantic schemas · router returns schemas
# Pattern: [Angular/React frontend] → FastAPI router → service → repository → DB
#
# Path note: paths follow FastAPI project layout (app/).
# Adjust to match your project's actual directory structure.

---

## DO NOT rules (apply to every file in this spec)

- DO NOT build SQL by f-string or `%`-format — always ORM or parameterised `text()`
- DO NOT use `RETURNING id` in raw SQL — SQL Server does not support it; use ORM `flush()` to get the inserted id
- DO NOT use trailing-slash collection routes (`"/"`) — FastAPI redirects bare paths; use `""` for collection routes
- DO NOT put business logic in the router — route handlers delegate to the service only
- DO NOT let `NotFoundError` or `ForbiddenError` go unmapped — always registered in `main.py` exception handlers
- DO NOT call `commit()` in the repository — the service commits so it can span multiple writes in one transaction
- DO NOT return Pydantic schemas from the repository — return ORM model objects; the service maps them
- DO NOT store auth tokens in localStorage — in-memory only (React) or HttpOnly cookie

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 0 | `app/dependencies.py` | DI wiring | Add `get_{feature}_service` factory |
| 1 | `app/exceptions.py` | Cross-cutting | Add `NotFoundError`, `ForbiddenError` domain exceptions (if not already present) |
| 2 | `app/main.py` | FastAPI | Register exception handlers for `NotFoundError`, `ForbiddenError` |
| 3 | `app/routers/{feature}.py` | FastAPI | Add/modify `APIRouter` and endpoints |
| 4 | `app/services/{feature}_service.py` | Service | Add/modify business logic |
| 5 | `app/schemas/{feature}_schema.py` | Schemas | `{Feature}Item`, `{Feature}Request`, `{Feature}Created` |
| 6 | `app/repositories/{feature}_repository.py` | Repository | ORM-based DB access; returns ORM models |
| 7 | `app/models/{feature}.py` | DB | SQLAlchemy ORM model *(if new table)* |
| 8 | `alembic/versions/{timestamp}_{feature}.py` | DB | Migration with `upgrade()` and `downgrade()` *(if schema changes)* |
| 9 | `apps/{app}/src/app/{feature}/{feature}.component.ts` | Angular *[if angular ∈ all_stacks]* | Add/modify component |
| 10 | `apps/{app}/src/app/{feature}/{feature}.component.html` | Angular *[if angular ∈ all_stacks]* | Add/modify template |
| 11 | `libs/{lib}/src/{feature}/{feature}.service.ts` | Angular *[if angular ∈ all_stacks]* | Add/modify Angular service |
| 12 | `libs/{lib}/src/{feature}/{feature}.model.ts` | Angular *[if angular ∈ all_stacks]* | TypeScript interfaces |
| 13 | `src/components/{Feature}/{Feature}.tsx` | React *[if react ∈ all_stacks]* | Add/modify React component |
| 14 | `src/hooks/use{Feature}.ts` | React *[if react ∈ all_stacks]* | Custom hook for data fetching |
| 15 | `src/services/{feature}.service.ts` | React *[if react ∈ all_stacks]* | HTTP service with `extractDetail` helper |
| 16 | `src/types/{feature}.types.ts` | React *[if react ∈ all_stacks]* | TypeScript interfaces |
| 17 | `tests/test_{feature}.py` | Tests | Service unit tests + router integration tests |

> Rows 9–12: include only when angular ∈ all_stacks. Omit if not present.
> Rows 13–16: include only when react ∈ all_stacks. Omit if not present.
> Rows 7–8: include only when schema changes are required.
> AC tags: every code section below shows `# AC-Fx` on the relevant line. Apply the same tag in every layer.

### AC Traceability

Every AC must map to at least one file. Every file must satisfy at least one AC.
See base template AC Coverage Matrix.

---

## Domain Exceptions — app/exceptions.py

Define once; import in service. Register handlers in `main.py`.

```python
class NotFoundError(Exception):
    """Resource does not exist or caller does not have visibility."""
    def __init__(self, detail: str = "Not found") -> None:
        self.detail = detail

class ForbiddenError(Exception):
    """Caller is authenticated but not authorised for this resource."""
    def __init__(self, detail: str = "Forbidden") -> None:
        self.detail = detail
```

Register in `app/main.py`:

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from app.exceptions import ForbiddenError, NotFoundError

@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": exc.detail})

@app.exception_handler(ForbiddenError)
async def forbidden_handler(_: Request, exc: ForbiddenError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": exc.detail})
```

---

## Dependency Wiring — app/dependencies.py

Wires DB session → repository → service. FastAPI resolves this chain on every request.
The service (not the repository) receives `db` so it can call `commit()` after writes.

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

> `get_session` yields a scoped session and closes it after the request completes.

---

## SQLAlchemy Model — app/models/{feature}.py *(include if schema changes)*

```python
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class {Feature}(Base):
    __tablename__ = "{table}"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    {field}: Mapped[str] = mapped_column(String(500), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
```

---

## Alembic Migration — alembic/versions/{timestamp}_{feature}.py *(include if schema changes)*

Always provide both `upgrade()` and `downgrade()`. Test `downgrade()` against a copy of the prod schema before merging.

```python
from alembic import op
import sqlalchemy as sa

revision = "{revision_id}"
down_revision = "{previous_revision_id}"

def upgrade() -> None:
    op.create_table(
        "{table}",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("{field}", sa.String(500), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("{table}")
```

---

## FastAPI Router — app/routers/{feature}.py

Thin router: validate via Pydantic, delegate to service, return schema.
Never put business logic here.

```python
from typing import Annotated
from fastapi import APIRouter, Depends, status
from app.schemas.{feature}_schema import {Feature}Request, {Feature}Item, {Feature}Created
from app.services.{feature}_service import {Feature}Service
from app.dependencies import get_current_user, get_{feature}_service
from app.models.user import User

router = APIRouter(prefix="/{feature}", tags=["{Feature}"])

@router.get("", response_model=list[{Feature}Item])                                         # AC-F1
async def get_{feature}(
    service: Annotated[{Feature}Service, Depends(get_{feature}_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[{Feature}Item]:
    return await service.get_{feature}(user_id=current_user.id)

@router.post("", response_model={Feature}Created, status_code=status.HTTP_201_CREATED)      # AC-F2
async def create_{feature}(
    request: {Feature}Request,
    service: Annotated[{Feature}Service, Depends(get_{feature}_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> {Feature}Created:
    return await service.create_{feature}(request, user_id=current_user.id)
```

---

## Pydantic Schemas — app/schemas/{feature}_schema.py

```python
from pydantic import BaseModel, Field, ConfigDict

class {Feature}Item(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # enables ORM → schema mapping

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

> `{Feature}Created` mirrors the created resource. The 201 status code carries the success signal — do not add `success: bool`.

---

## Service Layer — app/services/{feature}_service.py

Business logic only. No FastAPI imports — independently unit-testable.
Raises `NotFoundError` or `ForbiddenError` for missing/forbidden resources — never returns `None`.
Calls `commit()` after writes so the repository stays transaction-unaware.

```python
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.{feature}_schema import {Feature}Request, {Feature}Item, {Feature}Created
from app.repositories.{feature}_repository import {Feature}Repository
from app.exceptions import NotFoundError, ForbiddenError  # noqa: F401 — import for raise at swap time

class {Feature}Service:
    def __init__(self, repository: {Feature}Repository, db: AsyncSession) -> None:
        self._repository = repository
        self._db = db

    # STUB ADO-{ADO_ID} — swap when {swap criteria, e.g. DB table available}
    async def get_{feature}(self, user_id: int) -> list[{Feature}Item]:
        return [{Feature}Item(id=1, {field}="Stub value")]   # AC-F1

    async def create_{feature}(
        self, request: {Feature}Request, user_id: int
    ) -> {Feature}Created:
        orm_obj = await self._repository.insert(           # AC-F2
            {field}=request.{field}, user_id=user_id
        )
        await self._db.commit()
        return {Feature}Created.model_validate(orm_obj)
```

**Stub swap checklist (get_{feature}):**
1. Search `# STUB ADO-{ADO_ID}` in the codebase
2. Replace stub with `orm_objects = await self._repository.get_by_user(user_id=user_id)`
3. Map ORM → schema: `return [{Feature}Item.model_validate(o) for o in orm_objects]`
4. Raise `NotFoundError` / `ForbiddenError` instead of returning `None` for missing/forbidden data
5. Update unit tests to mock the repository (see Tests section)
6. Remove this comment block after swap

---

## Repository Layer — app/repositories/{feature}_repository.py

All DB access via SQLAlchemy ORM. Returns ORM model objects — never Pydantic schemas.
Never calls `commit()` — the service commits after all writes in the transaction complete.

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.{feature} import {Feature} as {Feature}Model

class {Feature}Repository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_user(self, user_id: int) -> list[{Feature}Model]:   # AC-F1
        result = await self._db.execute(
            select({Feature}Model).where({Feature}Model.user_id == user_id)
        )
        return list(result.scalars().all())

    async def insert(self, {field}: str, user_id: int) -> {Feature}Model:   # AC-F2
        # DECISION: ORM add+flush instead of raw SQL INSERT.
        # RETURNING id is not supported on SQL Server; flush() assigns obj.id on any dialect.
        obj = {Feature}Model({field}={field}, user_id=user_id)
        self._db.add(obj)
        await self._db.flush()   # assigns obj.id without committing
        return obj
```

---

## Angular Frontend *(include if angular ∈ all_stacks)*

> If angular is not in all_stacks, omit this section entirely.
> Paths follow Nx monorepo layout: component in `apps/`, service in `libs/`.

### Angular Component — {Feature}Component

```typescript
@Component({
  selector: 'app-{feature}',
  standalone: true,
  imports: [ReactiveFormsModule],   // CommonModule not needed with @if/@for
  templateUrl: './{feature}.component.html',
  styleUrl: './{feature}.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {Feature}Component implements OnInit {
  private readonly {feature}Service = inject({Feature}Service);

  readonly items = signal<{Feature}Item[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void { this.load{Feature}(); }

  load{Feature}(): void {   // AC-F1
    this.isLoading.set(true);
    this.{feature}Service.get{Feature}().subscribe({
      next: data => { this.items.set(data); this.isLoading.set(false); },
      error: err  => { this.errorMessage.set(err.message); this.isLoading.set(false); },
    });
  }
}
```

**Template guidelines:**
- Use `@if` / `@for` (Angular 17+ control flow)
- ARIA: `aria-live="polite"` on dynamic regions; `aria-label` on icon-only buttons
- Never use `[innerHTML]` with untrusted data

### Angular Service — {Feature}Service

```typescript
// FastAPI error detail is a string for custom errors, an array of objects for 422 validation failures.
// This helper maps both forms to a single readable string.
function extractDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
  return 'An unexpected error occurred. Please try again.';
}

@Injectable({ providedIn: 'root' })
export class {Feature}Service {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/{feature}`;

  get{Feature}(): Observable<{Feature}Item[]> {   // AC-F1
    return this.http.get<{Feature}Item[]>(this.baseUrl).pipe(
      catchError(err => throwError(() => new Error(extractDetail(err.error?.detail)))),
    );
  }

  save{Feature}(payload: {Feature}Request): Observable<{Feature}Created> {   // AC-F2
    return this.http.post<{Feature}Created>(this.baseUrl, payload).pipe(
      catchError(err => throwError(() => new Error(extractDetail(err.error?.detail)))),
    );
  }
}
```

---

## React Frontend *(include if react ∈ all_stacks)*

> If react is not in all_stacks, omit this section entirely.
> Paths follow Vite project layout (src/).

### React Component — {Feature}.tsx

```tsx
import { use{Feature} } from '../hooks/use{Feature}';
import styles from './{Feature}.module.css';

// Functional component — no React.FC, no import React (modern JSX transform)
export function {Feature}() {
  const { items, isLoading, errorMessage } = use{Feature}();   // AC-F1

  if (isLoading) return <div role="status" aria-live="polite">Loading...</div>;
  if (errorMessage) return <div role="alert" className={styles.error}>{errorMessage}</div>;

  return (
    <ul aria-label="{Feature} list" className={styles.list}>
      {items.map(item => (
        <li key={item.id}>{item.{field}}</li>
      ))}
    </ul>
  );
}
```

**Guidelines:**
- CSS Modules — no inline styles, no global class names
- ARIA: `aria-live="polite"` on dynamic regions; `aria-label` on icon-only buttons
- Never `dangerouslySetInnerHTML` with untrusted data

### Custom Hook — use{Feature}.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { {feature}Service } from '../services/{feature}.service';
import type { {Feature}Item } from '../types/{feature}.types';

export function use{Feature}() {   // AC-F1
  const [items, setItems] = useState<{Feature}Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setItems(await {feature}Service.get{Feature}());
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, isLoading, errorMessage, refresh: load };
}
```

### HTTP Service — {feature}.service.ts (React)

```typescript
import axios from 'axios';
import type { {Feature}Item, {Feature}Request, {Feature}Created } from '../types/{feature}.types';

const BASE_URL = `${import.meta.env.VITE_API_URL}/{feature}`;

// FastAPI error detail is a string for custom errors, an array of objects for 422 validation failures.
// This helper maps both forms to a single readable string.
function extractDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? String(e)).join('; ');
  return 'An unexpected error occurred. Please try again.';
}

export const {feature}Service = {
  async get{Feature}(): Promise<{Feature}Item[]> {   // AC-F1
    try {
      const { data } = await axios.get<{Feature}Item[]>(BASE_URL);
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) throw new Error(extractDetail(err.response?.data?.detail));
      throw err;
    }
  },
  async save{Feature}(payload: {Feature}Request): Promise<{Feature}Created> {   // AC-F2
    try {
      const { data } = await axios.post<{Feature}Created>(BASE_URL, payload);
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) throw new Error(extractDetail(err.response?.data?.detail));
      throw err;
    }
  },
};
```

---

## Tests — tests/test_{feature}.py

### Service unit test (mock repository)

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.{feature}_service import {Feature}Service
from app.schemas.{feature}_schema import {Feature}Request
from app.models.{feature} import {Feature} as {Feature}Model

@pytest.fixture
def mock_repo():
    return MagicMock()

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.commit = AsyncMock()
    return db

@pytest.fixture
def service(mock_repo, mock_db):
    return {Feature}Service(repository=mock_repo, db=mock_db)

@pytest.mark.asyncio
async def test_create_{feature}_returns_created_item(service, mock_repo, mock_db):   # AC-F2
    mock_repo.insert = AsyncMock(
        return_value={Feature}Model(id=1, {field}="test value", user_id=42)
    )
    result = await service.create_{feature}({Feature}Request({field}="test value"), user_id=42)
    assert result.id == 1
    assert result.{field} == "test value"
    mock_db.commit.assert_awaited_once()
```

### Router integration test (httpx.AsyncClient)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock
from app.main import app
from app.dependencies import get_{feature}_service

@pytest.mark.asyncio
async def test_get_{feature}_returns_200():   # AC-F1
    mock_service = AsyncMock()
    mock_service.get_{feature} = AsyncMock(return_value=[])
    app.dependency_overrides[get_{feature}_service] = lambda: mock_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/{feature}", headers={"Authorization": "Bearer test-token"})

    assert response.status_code == 200
    app.dependency_overrides.clear()
```

---

## API Changes

### Frontend → Python FastAPI endpoints

| Method | Route | Auth | Parameters | Response codes |
|---|---|---|---|---|
| GET | `/{feature}` | Bearer token | — | 200, 401, 403, 404 |
| POST | `/{feature}` | Bearer token | `{Feature}Request` body | 201, 401, 403, 422 |

> FastAPI returns 422 Unprocessable Entity for Pydantic validation failures.
> The `detail` field on a 422 response is an array of objects (`[{loc, msg, type}]`), not a string.
> Both Angular and React services use `extractDetail()` to convert it to a human-readable string.
> CORS `allow_methods` must list every HTTP verb in use — update it when adding new endpoints.

### DB / persistence changes

{Describe any schema changes. If none: "No DB changes in this story."}

---

## Auth & Security

### Python FastAPI — JWT validation

Apply `get_current_user` on every protected endpoint using `Annotated[User, Depends(get_current_user)]`.
CORS: restrict `allow_origins` to the known frontend origin. No wildcard in production.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],   # never "*" in production
    allow_credentials=True,
    allow_methods=["GET", "POST"],   # keep in sync with router — add verbs when adding endpoints
    allow_headers=["Authorization", "Content-Type"],
)
```

### Frontend — token attachment

Angular: `HttpInterceptor` attaches Bearer token to requests to `environment.apiUrl`.
React: axios interceptor attaches Bearer token from in-memory auth store (never `localStorage`).

### XSS analysis

| Location | Method | Safe? |
|---|---|---|
| Angular `{{ expression }}` | Auto-escaped | ✅ Yes |
| Angular `[innerHTML]` | NOT escaped | ⚠ Flag any usage |
| React JSX `{value}` | Auto-escaped | ✅ Yes |
| React `dangerouslySetInnerHTML` | NOT escaped | ⚠ Flag any usage |
| FastAPI JSON response | Pydantic serialised | ✅ Yes |

---

## Reviewer Checklist

**Auth:**
- [ ] All protected endpoints use `Annotated[User, Depends(get_current_user)]`
- [ ] No endpoint is accidentally public (missing `Depends` on a protected route)
- [ ] CORS `allow_origins` does not use `"*"` in production
- [ ] CORS `allow_methods` lists every HTTP verb used by the router
- [ ] Frontend attaches Bearer token on every API call

**Data access:**
- [ ] All DB queries use ORM or parameterised `text()` — no f-string or `%`-format SQL
- [ ] No `RETURNING id` in raw SQL — ORM `flush()` used instead
- [ ] Repository returns ORM model objects, not Pydantic schemas
- [ ] `commit()` called in service, not repository
- [ ] Alembic `upgrade()` tested on blank DB and on current prod schema
- [ ] Alembic `downgrade()` tested against a copy of prod schema

**Error handling:**
- [ ] Service raises `NotFoundError` / `ForbiddenError` — never returns `None` for missing/forbidden data
- [ ] Both exception handlers registered in `main.py`
- [ ] No secrets or PII written to exception messages or logs
- [ ] Frontend 422: `extractDetail()` in use; user sees a readable string, not `[object Object]`

**Stub integrity:**
- [ ] `get_{feature}` stub marked `# STUB ADO-{ADO_ID}` with swap criteria
- [ ] Stub swap checklist (6-step) present in the service

**AC coverage:**
- [ ] Every AC maps to at least one file (AC Coverage Matrix complete)
- [ ] `# AC-Fx` tag present in router, service, and repository for each AC

**Regression:**
- [ ] Existing FastAPI routes unaffected
- [ ] Existing frontend routes/components unaffected
