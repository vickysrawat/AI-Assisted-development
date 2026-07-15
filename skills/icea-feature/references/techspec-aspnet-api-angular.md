# Tech Spec Overlay — ASP.NET Web API + Angular
# Stack: (dotnet OR dotnet_framework) + angular, no nodejs.
#   dotnet           = .NET Core / .NET 5+ / .NET 10 — use TypedResults, record DTOs
#   dotnet_framework = .NET Framework 4.x          — use IHttpActionResult, class DTOs
# Pattern: Angular standalone component → Angular service (HttpClient) →
#          ASP.NET Web API controller → service  (no Node.js BFF layer)
#
# Path note: NX monorepo paths shown (apps/*, libs/*).
# Standard Angular (non-NX): replace with src/app/{feature}/ and src/app/services/.
# Adjust to match your project's actual directory structure.

---

## Files Changed

| # | File | Project | Change |
|---|---|---|---|
| 1 | `apps/{app}/src/app/{feature}/{feature}.component.ts` | {AngularApp} | Add/modify component |
| 2 | `apps/{app}/src/app/{feature}/{feature}.component.html` | {AngularApp} | Add/modify template |
| 3 | `apps/{app}/src/app/{feature}/{feature}.component.scss` | {AngularApp} | Add/modify styles |
| 4 | `libs/{lib}/src/{feature}/{feature}.service.ts` | {AngularLib} | Add/modify Angular service |
| 5 | `libs/{lib}/src/{feature}/{feature}.model.ts` | {AngularLib} | Add TypeScript interface |
| 6 | `Controllers/{Feature}Controller.cs` | {KE.Project.Api} | Add/modify API controller |
| 7 | `Services/I{Feature}Service.cs` | {KE.Project.Services} | Add service interface |
| 8 | `Services/{Feature}Service.cs` | {KE.Project.Services} | Implement service (stub/real) |
| 9 | `Models/{Feature}Model.cs` | {KE.Project.Models} | Add/modify DTO |

> Standard Angular (non-NX): replace rows 1–5 with `src/app/{feature}/` paths.
> Locate existing files via the solution structure — do not invent paths.

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

  // State — prefer signals for local UI state
  readonly items = signal<{Feature}Item[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.load{Feature}();
  }

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
- Use `@if` / `@for` (Angular 17+ control flow — not `*ngIf`)
- ARIA: `aria-live="polite"` on dynamic regions; `aria-label` on icon-only buttons
- Never use `[innerHTML]` with untrusted data — flag any `DomSanitizer.bypassSecurityTrustHtml` use in Reviewer Checklist

---

## Angular Service — {Feature}Service

Calls the .NET API directly. No Node.js BFF layer.

```typescript
@Injectable({ providedIn: 'root' })
export class {Feature}Service {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/{feature}`;

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

## TypeScript Interface / DTO — {Feature}Model

Mirrored exactly from the .NET DTO. Use `readonly` to prevent accidental mutation.

```typescript
// libs/{lib}/src/{feature}/{feature}.model.ts

export interface {Feature}Item {
  readonly id: number;
  readonly {field}: string;
  readonly {optionalField}?: string;   // null-safe: use optional chain ?.
  readonly items: readonly {SubItem}[]; // never null — use empty array []
}

export interface {Feature}Request {
  readonly {field}: string;
}

export interface {Feature}Response {
  readonly id: number;
  readonly success: boolean;
}
```

---

## ASP.NET Web API Controller — {Feature}Controller.cs

Thin controller — validate input, delegate to service, return result.

**Modern (.NET Core / .NET 5+ / .NET 10):**
```csharp
/// <summary>
/// {Feature} API — AC-{Fx}
/// </summary>
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

    [HttpGet, Route("")]           // AC-F1
    public async Task<IHttpActionResult> Get{Feature}()
    {
        var result = await _service.Get{Feature}Async();
        return Ok(result);
    }

    [HttpPost, Route("")]          // AC-F2
    public async Task<IHttpActionResult> Save{Feature}([FromBody] {Feature}Request request)
    {
        if (request == null) return BadRequest("Request body is required.");
        var result = await _service.Save{Feature}Async(request);
        return Ok(result);
    }
}
```

---

## Service Interface — I{Feature}Service.cs

```csharp
public interface I{Feature}Service
{
    /// <summary>
    /// Returns {description}. — AC-F1
    /// </summary>
    Task<IEnumerable<{Feature}Item>> Get{Feature}Async();

    /// <summary>
    /// Saves {description}. — AC-F2
    /// </summary>
    Task<{Feature}Response> Save{Feature}Async({Feature}Request request);
}
```

---

## Service Implementation — {Feature}Service.cs

**Stub implementation (ships with story):**
```csharp
// STUB ADO-{ADO_ID} — swap when {swap criteria, e.g. integration endpoint is available}
public class {Feature}Service : I{Feature}Service
{
    public Task<IEnumerable<{Feature}Item>> Get{Feature}Async()
        => Task.FromResult<IEnumerable<{Feature}Item>>(new[]
        {
            new {Feature}Item { Id = 1, {Field} = "Stub value" },
        });

    public Task<{Feature}Response> Save{Feature}Async({Feature}Request request)
        => Task.FromResult(new {Feature}Response { Id = 1, Success = true });
}
```

**Stub swap checklist (for the developer performing the swap):**
1. Search for `// STUB ADO-{ADO_ID}` in the codebase
2. Replace stub return values with the real integration call (HTTP client / DB query)
3. Add error handling for network/timeout failures (return a user-visible message)
4. Update unit tests to mock the real dependency instead of the in-memory stub
5. Remove this comment block after swap is complete

---

## DTO / Model — {Feature}Model.cs

**Modern (.NET Core/5+/10):**
```csharp
namespace {KE.Project}.Models;

/// <summary>{Feature} item returned to the Angular client.</summary>
public record {Feature}Item(
    int Id,
    [property: JsonPropertyName("{field}")] string Field,
    IReadOnlyList<{SubItem}> Items  // never null — default to empty list
);

public record {Feature}Request(
    [property: JsonPropertyName("{field}")] string Field
);

public record {Feature}Response(int Id, bool Success);
```

**Legacy (.NET Framework 4.x — Newtonsoft.Json):**
```csharp
public class {Feature}Item
{
    public int Id { get; set; }
    [JsonProperty("{field}")]
    public string Field { get; set; }
    public List<{SubItem}> Items { get; set; } = new List<{SubItem}>();
}
```

---

## API Changes

### New endpoint(s)

| Method | Route | Auth policy | Anti-forgery | Parameters | Response codes |
|---|---|---|---|---|---|
| GET | `/api/{feature}` | `{PolicyName}` | Not required (read-only) | — | 200, 401, 403 |
| POST | `/api/{feature}` | `{PolicyName}` | Not required (API, no cookies) | `{Feature}Request` body | 200, 400, 401, 403 |

> Angular calls the .NET API directly — no Node.js intermediate layer.
> CORS: Angular origin (`http://localhost:{port}` dev, `https://{prod-domain}`) must be in CORS policy.

### DB / persistence changes

{Describe any EF Core migrations, Dapper SQL, or stored proc changes. If none: "No DB changes in this story."}

---

## Auth & Security

### Angular — token attachment

Angular `HttpInterceptor` attaches Bearer token to every request to `environment.apiUrl`.
Confirm the interceptor is registered and covers the .NET API base URL.

Route guard (`AuthGuard` or `MsalGuard`) must be applied to the Angular route for this feature.

### .NET — authorization

| Endpoint | Policy/Role | Rationale |
|---|---|---|
| GET `/api/{feature}` | `{PolicyName}` | {Why this role} |
| POST `/api/{feature}` | `{PolicyName}` | {Why this role} |

CORS policy must include Angular dev origin and production origin. No wildcard (`*`) in production.

Anti-forgery not required — API-only (no cookies, no form posts). Document in ADR if this changes.

### XSS analysis

| Location | Method | Safe? |
|---|---|---|
| Angular template `{{ expression }}` | Auto-escaped | ✅ Yes |
| Angular `[innerHTML]` | NOT escaped | ⚠ Flag any usage |
| .NET JSON response | Serialised | ✅ Yes |

---

## Reviewer Checklist

**Auth:**
- [ ] `[Authorize(Policy)]` applied to all non-public .NET endpoints
- [ ] Angular route guard verified
- [ ] Angular `HttpInterceptor` covers the .NET API base URL
- [ ] CORS policy includes Angular origins (dev + prod); no wildcard in prod

**XSS:**
- [ ] No `[innerHTML]` in Angular templates unless explicitly reviewed
- [ ] No `DomSanitizer.bypassSecurityTrustHtml` usage

**Stub integrity:**
- [ ] Stub clearly marked `// STUB ADO-{ADO_ID}` with swap criteria
- [ ] Stub swap checklist present in service implementation

**Regression:**
- [ ] Existing Angular routes not affected by new component/service
- [ ] Existing .NET API routes not broken by new controller routing
- [ ] CORS policy change (if any) does not break existing API consumers
