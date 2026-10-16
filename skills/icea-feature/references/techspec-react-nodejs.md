# Tech Spec Overlay — React + Node.js [+ optional .NET or Python API layer]
# Stack: react + nodejs in all_stacks (primary ∪ external_detected_stacks).
# Optional API layer: include .NET sections when dotnet OR dotnet_framework ∈ all_stacks.
#                     include Python sections when python ∈ all_stacks.
#   dotnet           = .NET Core / .NET 5+ / .NET 10
#   dotnet_framework = .NET Framework 4.x (System.Web / WCF)
#   python           = FastAPI / Django / Flask
#   Mutually exclusive — a project has at most one backend API layer.
#
# Path note: paths shown for a Vite/CRA-style React project (src/).
# Adjust to match your project's actual directory structure.
#
# Pattern: React component → custom hook → HTTP service (axios) →
#          Node.js/Express controller → service → [.NET API or Python API — conditional]

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 1 | `src/components/{Feature}/{Feature}.tsx` | React | Add/modify component |
| 2 | `src/components/{Feature}/{Feature}.module.css` | React | Add/modify styles |
| 3 | `src/hooks/use{Feature}.ts` | React | Custom hook for data fetching and state |
| 4 | `src/services/{feature}.service.ts` | React | HTTP service (axios) |
| 5 | `src/types/{feature}.types.ts` | React | TypeScript interfaces |
| 6 | `src/controllers/{feature}.controller.ts` | Node.js | Add/modify Express controller |
| 7 | `src/services/{feature}.service.ts` | Node.js | Add/modify business logic service |
| 8 | `src/dtos/{feature}.dto.ts` | Node.js | Request/response DTOs |
| 9 | `Controllers/{Feature}Controller.cs` | .NET [if dotnet ∈ all_stacks] | Add/modify API controller |
| 10 | `Services/I{Feature}Service.cs` | .NET [if dotnet ∈ all_stacks] | Service interface |
| 11 | `Services/{Feature}Service.cs` | .NET [if dotnet ∈ all_stacks] | Service implementation |
| 12 | `Models/{Feature}Model.cs` | .NET [if dotnet ∈ all_stacks] | DTO / record |
| 13 | `app/routers/{feature}.py` | Python [if python ∈ all_stacks] | Add/modify FastAPI router |
| 14 | `app/services/{feature}_service.py` | Python [if python ∈ all_stacks] | Business logic service |
| 15 | `app/schemas/{feature}_schema.py` | Python [if python ∈ all_stacks] | Pydantic schemas |

> Rows 9–12: include only when dotnet or dotnet_framework ∈ all_stacks.
> Rows 13–15: include only when python ∈ all_stacks.
> Rows 9–15 are mutually exclusive — a project has at most one backend API layer.

### AC Traceability

Every AC must map to at least one file. Every file must satisfy at least one AC.
See base template AC Coverage Matrix.

---

## React Component — {Feature}.tsx

Functional component. Keep JSX minimal — all data logic lives in the custom hook.

```tsx
import React from 'react';
import { use{Feature} } from '../../hooks/use{Feature}';
import styles from './{Feature}.module.css';

export const {Feature}: React.FC = () => {
  const { items, isLoading, errorMessage, refresh } = use{Feature}();

  if (isLoading) return <div role="status" aria-live="polite" className={styles.loading}>Loading...</div>;
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
};
```

**Template guidelines:**
- ARIA: `aria-live="polite"` on dynamic regions; `aria-label` on icon-only buttons
- Never set `dangerouslySetInnerHTML` with untrusted data
- CSS Modules for component-scoped styles — no global class mutations
- Use explicit prop types for all components; avoid `any`

---

## Custom Hook — use{Feature}.ts

All data fetching and state management here. Component stays pure view.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { {feature}Service } from '../services/{feature}.service';
import type { {Feature}Item, {Feature}Request } from '../types/{feature}.types';

interface Use{Feature}Result {
  items: {Feature}Item[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => void;
  save: (payload: {Feature}Request) => Promise<void>;
}

export function use{Feature}(): Use{Feature}Result {
  const [items, setItems] = useState<{Feature}Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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

  const save = useCallback(async (payload: {Feature}Request): Promise<void> => {
    await {feature}Service.save{Feature}(payload);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, isLoading, errorMessage, refresh, save };
}
```

---

## TypeScript Interfaces / DTOs — {feature}.types.ts / {feature}.dto.ts

Shared shape across React and Node.js layers. Use `readonly` to prevent accidental mutation.

```typescript
// src/types/{feature}.types.ts  (React)
// src/dtos/{feature}.dto.ts      (Node.js — same shape)

export interface {Feature}Item {
  readonly id: number;
  readonly {field}: string;
  readonly {optionalField}?: string;
}

export interface {Feature}Request {
  readonly {field}: string;
}

export interface {Feature}Response {
  readonly id: number;
  readonly success: boolean;
}
```

If Zod is used in Node.js for validation:
```typescript
// src/dtos/{feature}.dto.ts
import { z } from 'zod';
export const {Feature}RequestSchema = z.object({ {field}: z.string().min(1) });
export type {Feature}Request = z.infer<typeof {Feature}RequestSchema>;
```

---

## HTTP Service — {feature}.service.ts (React)

Thin service — HTTP calls only, no state, no React imports. Independently testable.

```typescript
import axios from 'axios';
import type { {Feature}Item, {Feature}Request, {Feature}Response } from '../types/{feature}.types';

const BASE_URL = `${import.meta.env.VITE_API_URL}/{feature}`;

export const {feature}Service = {
  async get{Feature}(): Promise<{Feature}Item[]> {
    const { data } = await axios.get<{Feature}Item[]>(BASE_URL);
    return data;
  },
  async save{Feature}(payload: {Feature}Request): Promise<{Feature}Response> {
    const { data } = await axios.post<{Feature}Response>(BASE_URL, payload);
    return data;
  },
};
```

Auth interceptor (registered globally in `src/main.tsx` or `src/api/axios-config.ts`):
```typescript
axios.interceptors.request.use(config => {
  const token = /* from in-memory auth store — never localStorage for tokens */;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## Node.js Controller — {feature}.controller.ts

Express route handler. Thin — validate input, delegate to service, return JSON.

```typescript
import { Router, Request, Response } from 'express';
import { {Feature}Service } from '../services/{feature}.service';
import { {Feature}RequestSchema } from '../dtos/{feature}.dto';

export const {feature}Router = Router();
const service = new {Feature}Service();

// GET /api/{feature}                         AC-F1
{feature}Router.get('/', async (req: Request, res: Response) => {
  const result = await service.get{Feature}();
  res.json(result);
});

// POST /api/{feature}                        AC-F2
{feature}Router.post('/', async (req: Request, res: Response) => {
  const parsed = {Feature}RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', code: 'VALIDATION_ERROR',
      details: parsed.error.flatten() });
  }
  const result = await service.save{Feature}(parsed.data);
  res.status(201).json(result);
});
```

Auth middleware (`requireAuth`) must be registered at the router or route level — see Auth & Security.

---

## Node.js Service — {feature}.service.ts

Business logic only. No Express imports — independently unit-testable.

```typescript
export class {Feature}Service {
  // Stub implementation (ships with story)
  // STUB ADO-{ADO_ID} — swap when {swap criteria, e.g. backend API endpoint available}

  async get{Feature}(): Promise<{Feature}Item[]> {
    // TODO: replace with HTTP call to backend API or DB query
    return [{ id: 1, {field}: 'Stub value' }];
  }

  async save{Feature}(request: {Feature}Request): Promise<{Feature}Response> {
    // TODO: replace with HTTP call to backend API or DB mutation
    return { id: 1, success: true };
  }
}
```

**Stub swap checklist:**
1. Search for `// STUB ADO-{ADO_ID}` in the codebase
2. Replace stub with real integration (axios call to backend API / DB query)
3. Add try/catch — never let internal errors reach the Express response raw
4. Update unit tests to mock the real dependency
5. Remove this comment block after swap

---

## .NET API Layer — {Feature}Controller.cs

> **Include only when `dotnet` OR `dotnet_framework` ∈ all_stacks.**
> If neither appears in all_stacks, omit this section and rows 9–12 in Files Changed.

Node.js calls this .NET API on behalf of the React client. React does not call .NET directly.

**Modern (.NET Core / .NET 5+ / .NET 10):**
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "{PolicyName}")]
public class {Feature}Controller : ControllerBase
{
    private readonly I{Feature}Service _service;
    public {Feature}Controller(I{Feature}Service service) => _service = service;

    [HttpGet]   public async Task<IResult> Get{Feature}()                                      // AC-F1
        => TypedResults.Ok(await _service.Get{Feature}Async());

    [HttpPost]  public async Task<IResult> Save{Feature}([FromBody] {Feature}Request request)  // AC-F2
    {
        if (request is null) return TypedResults.BadRequest("Request body is required.");
        return TypedResults.Created($"/api/{feature}", await _service.Save{Feature}Async(request));
    }
}
```

**Legacy (.NET Framework 4.x):**
```csharp
[RoutePrefix("api/{feature}")]
[Authorize]
public class {Feature}Controller : ApiController
{
    private readonly I{Feature}Service _service;
    public {Feature}Controller(I{Feature}Service service) => _service = service;

    [HttpGet, Route("")]  public async Task<IHttpActionResult> Get{Feature}()
        => Ok(await _service.Get{Feature}Async());

    [HttpPost, Route("")]
    public async Task<IHttpActionResult> Save{Feature}([FromBody] {Feature}Request request)
    {
        if (request == null) return BadRequest("Request body required.");
        return Ok(await _service.Save{Feature}Async(request));
    }
}
```

See `techspec-angular-nodejs.md` for the full .NET service interface, implementation, and DTO patterns —
they are identical whether the frontend is Angular or React.

---

## Python API Layer *(include if python ∈ all_stacks)*

> **Include only when `python` ∈ all_stacks.** Omit rows 13–15 in Files Changed if absent.

Node.js calls this Python API. React does not call Python directly.
See `techspec-python-fastapi.md` for the full service, repository, and schema patterns.

```python
from fastapi import APIRouter, Depends, status
from app.schemas.{feature}_schema import {Feature}Request, {Feature}Response, {Feature}Item
from app.dependencies import get_{feature}_service

router = APIRouter(prefix="/{feature}", tags=["{Feature}"])

@router.get("/", response_model=list[{Feature}Item])                                    # AC-F1
async def get_{feature}(service=Depends(get_{feature}_service)) -> list[{Feature}Item]:
    return await service.get_{feature}()

@router.post("/", response_model={Feature}Response, status_code=status.HTTP_201_CREATED)  # AC-F2
async def create_{feature}(request: {Feature}Request, service=Depends(get_{feature}_service)):
    return await service.create_{feature}(request)
```

---

## API Changes

### React → Node.js BFF endpoints

| Method | Route | Auth middleware | Parameters | Response codes |
|---|---|---|---|---|
| GET | `/api/{feature}` | `requireAuth` | — | 200, 401, 403 |
| POST | `/api/{feature}` | `requireAuth` | `{Feature}Request` body | 201, 400, 401, 403 |

### Node.js → backend API calls *(include if .NET or Python layer present)*

| Method | Backend Route | Auth | Parameters | Notes |
|---|---|---|---|---|
| GET | `/api/{feature}` | Bearer token forwarded | — | Node.js forwards user token |
| POST | `/api/{feature}` | Bearer token forwarded | `{Feature}Request` body | — |

### DB / persistence changes

{Describe any schema changes. If none: "No DB changes in this story."}

---

## Auth & Security

### React — token to Node.js BFF

Axios interceptor attaches Bearer token from in-memory auth store.
Never store tokens in `localStorage` — use session memory or `HttpOnly; Secure; SameSite=Strict` cookies.
Route guard must protect the React route (React Router v6: loader or component-level auth check).

### Node.js — token validation and forwarding

JWT middleware validates the token on every request. Forward the same token to the backend API
using `Authorization: Bearer {token}` header — do not issue a new token.
Apply `helmet()` globally and restrict CORS to known React origins.

```typescript
app.use(helmet());
app.use(cors({ origin: process.env.REACT_ORIGIN, credentials: true }));
app.use('/api/{feature}', requireAuth, {feature}Router);
```

### .NET — authorization *(include if .NET layer present)*

| Endpoint | Policy/Role | Rationale |
|---|---|---|
| GET `/api/{feature}` | `{PolicyName}` | {Why} |
| POST `/api/{feature}` | `{PolicyName}` | {Why} |

CORS: Node.js BFF origin must be in the .NET CORS policy. No wildcard in production.

### XSS analysis

| Location | Method | Safe? |
|---|---|---|
| React JSX `{value}` | Auto-escaped | ✅ Yes |
| React `dangerouslySetInnerHTML` | NOT escaped | ⚠ Flag any usage |
| Node.js JSON response | `res.json()` | ✅ Yes |
| .NET JSON response | Serialised | ✅ Yes |

---

## Reviewer Checklist

**Auth:**
- [ ] React route guard verified
- [ ] Axios interceptor covers Node.js BFF URL — no unguarded calls
- [ ] Tokens in memory / `HttpOnly` cookie — not `localStorage`
- [ ] Node.js JWT middleware applied to all protected routes
- [ ] Node.js forwards Bearer token to backend — no re-issue
- [ ] .NET `[Authorize(Policy)]` on all non-public endpoints *(if .NET layer present)*
- [ ] CORS: React origin in Node.js config; .NET/Python allows Node.js BFF origin *(if applicable)*

**XSS:**
- [ ] No `dangerouslySetInnerHTML` in React unless reviewed
- [ ] No direct DOM manipulation bypassing React's escaping

**Stub integrity:**
- [ ] Node.js service stub marked `// STUB ADO-{ADO_ID}` with swap criteria
- [ ] .NET service stub marked `// STUB ADO-{ADO_ID}` *(if .NET layer present)*
- [ ] Stub swap checklists present

**Regression:**
- [ ] Existing React routes/components unaffected
- [ ] Existing Node.js routes unaffected
- [ ] Existing .NET API routes unaffected *(if .NET layer present)*
