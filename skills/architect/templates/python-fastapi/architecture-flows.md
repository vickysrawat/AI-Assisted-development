<!-- TEMPLATE -->
# Architecture — Request Flows

> Load this file when tracing how a request moves through the FastAPI app,
> or when changing behaviour that spans multiple layers.

## Call Chains

### [Endpoint Name — e.g. "POST /items/{id}/submit"]

> What this endpoint does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as Middleware Stack
    participant Router as FastAPI Router
    participant Dependency as Dependency ([Depends()])
    participant Service as [ServiceName]
    participant DB as Database / ORM

    Client->>Middleware: [HTTP METHOD] /[route] {[RequestModel]}
    Note over Middleware: [CORSMiddleware / AuthMiddleware] — checks [origin / bearer token]
    Middleware->>Router: Request reaches [router prefix]/[path]
    Router->>Dependency: Resolves [Depends(get_db) / Depends(get_current_user)]
    Note over Dependency: Yields db session; verifies JWT and returns [UserSchema]
    Dependency->>Router: [db: Session, current_user: UserSchema]
    Router->>Service: [function_name]([RequestModel], db, current_user)
    Note over Service: Business logic — [what it validates or computes]
    Service->>DB: [session.query / session.execute](parameterised query)
    Note over DB: Pydantic model validated before any write; no raw string SQL
    DB-->>Service: [ORM model / Row]
    Service-->>Router: [ResponseModel]
    Note over Router: Pydantic serialises to JSON; [status_code] set by decorator
    Router-->>Client: HTTP [200/201/422] {[ResponseModel]}
```

---

## Dependency Graph

| Unit | Type | Dependencies |
|------|------|-------------|

## Highest Fan-In

| Type | Injected/Imported by |
|------|----------------------|

## Highest Fan-Out

| Unit | Dependency Count |
|------|------------------|
