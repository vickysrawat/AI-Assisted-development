---
paths: ["**/*.cs", "**/Controllers/**", "**/Services/**", "**/Repositories/**"]
---

# .NET / C# Rules — Applied to all .cs files

## Architecture
- Thin controllers: no business logic, only input validation + service call + response mapping
- Service layer owns all business logic and calls Repository
- Repository layer owns all data access — use Dapper with parameterised SQL.
  Never use EF Core. Raw SQL is fine and expected; always use parameters,
  never string concatenation.
- DTOs never reference domain entities directly

## Response Standards
- Success: return typed DTO with appropriate HTTP status
- Validation error: 400 with FluentValidation ProblemDetails
- Not found: 404 with ProblemDetails `detail` explaining what was not found
- Unauthorized: 401 (no auth) or 403 (insufficient role) — never 404 for security reasons
- Server error: 500 ProblemDetails — log full exception, return sanitized message only

## Auth Pattern
- Apply `[Authorize(Policy = "PolicyName")]` at controller level, not action level
- Never trust client-provided user IDs — always resolve from token claims
- Use `ICurrentUserService` to access claims — do not read HttpContext directly in services

## Documentation
- Add XML doc comments (`/// <summary>`) on all public methods, properties, and classes

## File Naming
- Files: `PascalCase.cs` (e.g. `UserFilterService.cs`, `IUserFilterService.cs`)
- DB migrations: `YYYYMMDD_DescriptiveName.sql`

## Testing Pattern
- Arrange / Act / Assert with blank lines between sections
- Mock all dependencies with Moq
- Test method name: `MethodName_WhenCondition_ThenExpectedBehavior`
- One assertion concept per test (multiple Assert lines for the same concept is fine)
- Always test the error state and permission boundary from the ICEA
