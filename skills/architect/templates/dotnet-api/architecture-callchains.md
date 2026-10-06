<!-- TEMPLATE -->
# Architecture — Call Chains

> Load this file when tracing a bug or feature through the request pipeline,
> or when doing impact analysis on specific endpoints.

## Call Chains

### [Endpoint Name] — [HTTP METHOD] [route]

> What this endpoint does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Client
    participant Controller as [ControllerName]
    participant Service as [ServiceName]
    participant Repository as [RepositoryName]
    participant DB as Database

    Client->>Controller: [HTTP METHOD] /[route] {[RequestBodyType]}
    Note over Controller: Validates [ModelState/FluentValidation], checks [Auth policy]
    Controller->>Service: [MethodName]([ParamType] param)
    Note over Service: [Business rule applied — e.g. "checks ownership, applies discount logic"]
    Service->>Repository: [MethodName]([query params])
    Note over Repository: Builds parameterised SQL — never string-concatenated
    Repository->>DB: SELECT / INSERT / UPDATE [Table]
    DB-->>Repository: [ResultSet / rows affected]
    Repository-->>Service: [EntityType] / null
    Service-->>Controller: [ServiceResultType]
    Note over Controller: Maps to [ResponseType], sets HTTP status
    Controller-->>Client: HTTP [200/201/400/404] [ResponseType]
```

---

## Class-Level Dependency Graph

### Controllers

| Class | Constructor Injections |
|-------|----------------------|

### Services

| Class | Interface | Constructor Injections |
|-------|-----------|----------------------|

### Repositories

| Class | Interface | Constructor Injections |
|-------|-----------|----------------------|

### External APIs

| Class | Interface | Constructor Injections |
|-------|-----------|----------------------|

## Highest Fan-In (most depended-upon)

| Type | Depended on by |
|------|---------------|

## Highest Fan-Out (most dependencies)

| Class | Direct Dependencies |
|-------|-------------------|
