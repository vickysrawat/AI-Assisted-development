# Tech Spec Overlay — Angular + Node.js [+ optional .NET API layer]
# Stack: angular + nodejs in all_stacks (primary ∪ external_detected_stacks).
# .NET sections: include when `dotnet` OR `dotnet_framework` appears in all_stacks.
#   dotnet           = .NET Core / .NET 5+ / .NET 10
#   dotnet_framework = .NET Framework 4.x (System.Web / WCF)
#   Mutually exclusive — never both.
#
# Path note: NX monorepo paths shown (apps/*, libs/*).
# Standard Angular (non-NX): replace with src/app/{feature}/ and src/app/services/.
# Adjust to match your project's actual directory structure.
#
# Pattern: Angular standalone → Angular service (HttpClient to Node.js BFF) →
#          Node.js/Express controller → service → [.NET API — conditional]

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 1 | `apps/{app}/src/app/{feature}/{feature}.component.ts` | Angular | Add/modify component |
| 2 | `apps/{app}/src/app/{feature}/{feature}.component.html` | Angular | Add/modify template |
| 3 | `apps/{app}/src/app/{feature}/{feature}.component.scss` | Angular | Add/modify styles |
| 4 | `libs/{lib}/src/{feature}/{feature}.service.ts` | Angular | Add/modify Angular service |
| 5 | `libs/{lib}/src/{feature}/{feature}.model.ts` | Angular | TypeScript interfaces |
| 6 | `src/controllers/{feature}.controller.ts` | Node.js | Add/modify Express controller |
| 7 | `src/services/{feature}.service.ts` | Node.js | Add/modify business logic service |
| 8 | `src/dtos/{feature}.dto.ts` | Node.js | Request/response DTOs |
| 9 | `Controllers/{Feature}Controller.cs` | .NET [if dotnet ∈ all_stacks] | Add/modify API controller |
| 10 | `Services/I{Feature}Service.cs` | .NET [if dotnet ∈ all_stacks] | Service interface |
| 11 | `Services/{Feature}Service.cs` | .NET [if dotnet ∈ all_stacks] | Service implementation |
| 12 | `Models/{Feature}Model.cs` | .NET [if dotnet ∈ all_stacks] | DTO / record |

> Rows 9–12: include only when dotnet or dotnet_framework ∈ all_stacks. Omit if neither present.
> Standard Angular (non-NX): replace rows 1–5 with src/app/{feature}/ paths.

### AC Traceability

Every AC must map to at least one file. Every file must satisfy at least one AC.
See base template AC Coverage Matrix.

---

## Angular Component — {FeatureComponent}

Standalone component. Keep template logic minimal — delegate to service.

```typescript
@Component({
  selector: 'app-{feature}',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './{feature}.component.html',
  styleUrls: ['./{feature}.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {Feature}Component implements OnInit {
  private readonly {feature}Service = inject({Feature}Service);

  readonly items = signal<{Feature}Item[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void { this.load{Feature}(); }

  load{Feature}(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
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

---

## Angular Service — {Feature}Service

Calls the Node.js BFF. No direct .NET API access from the browser.

```typescript
@Injectable({ providedIn: 'root' })
export class {Feature}Service {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/{feature}`;

  get{Feature}(): Observable<{Feature}Item[]> {
    return this.http.get<{Feature}Item[]>(this.baseUrl).pipe(
      catchError(err => {
        const message = err.error?.message ?? 'An unexpected error occurred. Please try again.';
        return throwError(() => new Error(message));
      }),
    );
  }

  save{Feature}(payload: {Feature}Request): Observable<{Feature}Response> {
    return this.http.post<{Feature}Response>(this.baseUrl, payload).pipe(
      catchError(err => {
        const message = err.error?.message ?? 'Failed to save. Please try again.';
        return throwError(() => new Error(message));
      }),
    );
  }
}
```

---

## TypeScript Interfaces / DTOs — {Feature}Model

Shared across Angular and Node.js layers. Use `readonly` to prevent accidental mutation.

```typescript
// libs/{lib}/src/{feature}/{feature}.model.ts  (Angular)
// src/dtos/{feature}.dto.ts                   (Node.js — same shape)

export interface {Feature}Item {
  readonly id: number;
  readonly {field}: string;
  readonly {optionalField}?: string;
  readonly items: readonly {SubItem}[];
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
  res.json(result);
});
```

Auth middleware (e.g. `requireAuth`) must be registered at the router or route level — see Auth & Security.

---

## Node.js Service — {feature}.service.ts

Business logic only. No Express imports — independently unit-testable.

```typescript
export class {Feature}Service {
  // Stub implementation (ships with story)
  // STUB ADO-{ADO_ID} — swap when {swap criteria, e.g. .NET API endpoint available}

  async get{Feature}(): Promise<{Feature}Item[]> {
    // TODO: replace with HTTP call to .NET API or DB query
    return [{ id: 1, {field}: 'Stub value', items: [] }];
  }

  async save{Feature}(request: {Feature}Request): Promise<{Feature}Response> {
    // TODO: replace with HTTP call to .NET API or DB mutation
    return { id: 1, success: true };
  }
}
```

**Stub swap checklist:**
1. Search for `// STUB ADO-{ADO_ID}` in the codebase
2. Replace stub with real integration (axios call to .NET API / DB query)
3. Add try/catch — never let internal errors reach the Express response raw
4. Update unit tests to mock the real dependency
5. Remove this comment block after swap

---

## .NET API Layer — {Feature}Controller.cs

> **Include only when `dotnet` OR `dotnet_framework` ∈ all_stacks.**
> If neither appears in all_stacks, omit this section and rows 9–12 in Files Changed.

Node.js calls this .NET API on behalf of the Angular client. Angular does not call .NET directly.

**Modern (.NET Core / .NET 5+ / .NET 10):**
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "{PolicyName}")]
public class {Feature}Controller : ControllerBase
{
    private readonly I{Feature}Service _service;
    public {Feature}Controller(I{Feature}Service service) => _service = service;

    [HttpGet]                              // AC-F1
    public async Task<IResult> Get{Feature}()
    {
        var result = await _service.Get{Feature}Async();
        return TypedResults.Ok(result);
    }

    [HttpPost]                             // AC-F2
    public async Task<IResult> Save{Feature}([FromBody] {Feature}Request request)
    {
        if (request is null) return TypedResults.BadRequest("Request body is required.");
        var result = await _service.Save{Feature}Async(request);
        return TypedResults.Ok(result);
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

### .NET Service Interface

```csharp
public interface I{Feature}Service
{
    Task<IEnumerable<{Feature}Item>> Get{Feature}Async();   // AC-F1
    Task<{Feature}Response> Save{Feature}Async({Feature}Request request); // AC-F2
}
```

### .NET Service Implementation (stub)

```csharp
// STUB ADO-{ADO_ID} — swap when {swap criteria}
public class {Feature}Service : I{Feature}Service
{
    public Task<IEnumerable<{Feature}Item>> Get{Feature}Async()
        => Task.FromResult<IEnumerable<{Feature}Item>>(new[]
           { new {Feature}Item { Id = 1, {Field} = "Stub value" } });

    public Task<{Feature}Response> Save{Feature}Async({Feature}Request request)
        => Task.FromResult(new {Feature}Response { Id = 1, Success = true });
}
```

### .NET DTO / Record

**Modern (.NET Core/5+/10):**
```csharp
public record {Feature}Item(int Id,
    [property: JsonPropertyName("{field}")] string Field,
    IReadOnlyList<{SubItem}> Items);

public record {Feature}Request([property: JsonPropertyName("{field}")] string Field);
public record {Feature}Response(int Id, bool Success);
```

**Legacy (.NET Framework 4.x):**
```csharp
public class {Feature}Item
{
    public int Id { get; set; }
    [JsonProperty("{field}")] public string Field { get; set; }
    public List<{SubItem}> Items { get; set; } = new();
}
```

---

## API Changes

### Angular → Node.js BFF endpoints

| Method | Route | Auth middleware | Parameters | Response codes |
|---|---|---|---|---|
| GET | `/api/{feature}` | `requireAuth` | — | 200, 401, 403 |
| POST | `/api/{feature}` | `requireAuth` | `{Feature}Request` body | 200, 400, 401, 403 |

### Node.js → .NET API calls *(include if .NET layer present)*

| Method | .NET Route | Auth | Parameters | Notes |
|---|---|---|---|---|
| GET | `/api/{feature}` | Bearer token forwarded | — | Node.js forwards user token |
| POST | `/api/{feature}` | Bearer token forwarded | `{Feature}Request` body | — |

### DB / persistence changes

{Describe any schema changes. If none: "No DB changes in this story."}

---

## Auth & Security

### Angular — token to Node.js BFF

`HttpInterceptor` attaches Bearer token to requests to `environment.apiUrl` (Node.js BFF).
Route guard (`AuthGuard` / `MsalGuard`) must protect the Angular route.

### Node.js — token validation and forwarding

JWT middleware validates the token on every request. Forward the same token to .NET API
using `Authorization: Bearer {token}` header — do not issue a new token.
Apply `helmet()` globally and restrict CORS to known Angular origins.

```typescript
// Middleware registration example
app.use(helmet());
app.use(cors({ origin: process.env.ANGULAR_ORIGIN, credentials: true }));
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
| Angular `{{ expression }}` | Auto-escaped | ✅ Yes |
| Angular `[innerHTML]` | NOT escaped | ⚠ Flag any usage |
| Node.js JSON response | `res.json()` | ✅ Yes |
| .NET JSON response | Serialised | ✅ Yes |

---

## Reviewer Checklist

**Auth:**
- [ ] Angular route guard verified
- [ ] Angular `HttpInterceptor` covers Node.js BFF URL
- [ ] Node.js JWT middleware applied to all protected routes
- [ ] Node.js forwards Bearer token to .NET — no re-issue
- [ ] .NET `[Authorize(Policy)]` applied to all non-public endpoints *(if .NET layer present)*
- [ ] CORS: Angular origins in Node.js CORS config; .NET CORS allows Node.js BFF origin *(if .NET)*

**XSS:**
- [ ] No `[innerHTML]` in Angular templates unless reviewed
- [ ] No `DomSanitizer.bypassSecurityTrustHtml` usage

**Stub integrity:**
- [ ] Node.js service stub marked `// STUB ADO-{ADO_ID}` with swap criteria
- [ ] .NET service stub marked `// STUB ADO-{ADO_ID}` *(if .NET layer present)*
- [ ] Stub swap checklists present

**Regression:**
- [ ] Existing Angular routes unaffected
- [ ] Existing Node.js routes unaffected
- [ ] Existing .NET API routes unaffected *(if .NET layer present)*
