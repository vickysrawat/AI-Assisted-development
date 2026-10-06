<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a request through the pipeline,
> debugging a form submission, or understanding an AJAX interaction.

## Request Flows

### [Controller/Action or Page — e.g. "POST OrderController.Create"]

> What this flow does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware as ASP.NET Core Middleware
    participant Controller as [ControllerName].[ActionName]
    participant Service as [ServiceName]
    participant DAL as [Repository / DbContext]
    participant DB as Database

    Browser->>Middleware: [GET/POST] /[URL] {[FormData / JSON body]}
    Note over Middleware: [Authentication middleware] validates [cookie / bearer token]
    Middleware->>Controller: [ActionName]([ModelType] model)
    Note over Controller: Model binding from [form / route / query]; [Authorize] attribute checked
    Controller->>Service: [MethodName]([ServiceParam])
    Note over Service: Business logic — [what it does, e.g. "validates ownership, triggers workflow"]
    Service->>DAL: [MethodName]([params])
    Note over DAL: [EF Core / Dapper] parameterised query — no string-built SQL
    DAL->>DB: [SELECT / INSERT / UPDATE] [Table]
    DB-->>DAL: [Entity / rows affected]
    DAL-->>Service: [ReturnType]
    Service-->>Controller: [ServiceResult]
    Note over Controller: Selects view or returns JSON; sets [TempData / ViewBag] if redirect
    Controller-->>Browser: [View(model) / RedirectToAction / Ok(dto)]
```

---

## Authentication Flows

## JavaScript / AJAX Patterns

| JS File | Endpoint Called | Updates |
|---------|----------------|---------|
