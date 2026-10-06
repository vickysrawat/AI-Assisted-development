<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a request through the pipeline,
> debugging a form submission, or understanding an AJAX interaction.

## Request Flows

### [Controller/Action or Page — e.g. "POST HomeController.Submit"]

> What this flow does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Browser
    participant HttpModule as HTTP Module / Action Filter
    participant Controller as [ControllerName].[ActionName]
    participant Service as [ServiceName]
    participant DAL as [DAL/Repository]
    participant DB as Database

    Browser->>HttpModule: [GET/POST] /[URL] {[FormData / QueryString]}
    Note over HttpModule: [AuthorizationModule] checks [FormsAuth / Windows Auth / role]
    HttpModule->>Controller: Action invoked — model bound from [form/route/query]
    Note over Controller: [ActionFilter] runs — [what the filter checks/does]
    Controller->>Service: [MethodName]([ModelType] model)
    Note over Service: Business logic — [what it validates or computes]
    Service->>DAL: [MethodName]([params])
    Note over DAL: [ADO.NET / Dapper / EF] — parameterised query only
    DAL->>DB: [SELECT / INSERT / UPDATE] [Table]
    DB-->>DAL: [DataTable / entity / rows affected]
    DAL-->>Service: [ReturnType]
    Service-->>Controller: [ServiceResult]
    Note over Controller: Populates [ViewBag / ViewModel], selects view or redirects
    Controller-->>Browser: [View("ViewName", model) / RedirectToAction / JsonResult]
```

---

## Authentication Flows

## JavaScript / AJAX Patterns

| JS File | Endpoint Called | Updates |
|---------|----------------|---------|
