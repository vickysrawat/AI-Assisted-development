<!-- TEMPLATE -->
# Architecture — Request Flows

> Load this file when tracing how a request moves through the Flask app,
> or when changing behaviour that spans multiple layers.

## Call Chains

### [Route Name — e.g. "POST /api/v1/items"]

> What this endpoint does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Client
    participant BeforeRequest as @app.before_request / @login_required
    participant Blueprint as [BlueprintName] Blueprint
    participant View as [view_function]
    participant Service as [ServiceName]
    participant DB as Database / SQLAlchemy

    Client->>BeforeRequest: [HTTP METHOD] /[route] {[Payload]}
    Note over BeforeRequest: [login_required / jwt_required] — checks [session / token]; aborts 401 if missing
    BeforeRequest->>Blueprint: Request forwarded to [blueprint_name] blueprint
    Blueprint->>View: [view_function](request)
    Note over View: Parses request.json / request.form; validates with [marshmallow / manual check]
    View->>Service: [function_name]([params])
    Note over Service: Business logic — [what it does, e.g. "applies pricing rules, emits event"]
    Service->>DB: [db.session.query / db.session.add](parameterised)
    Note over DB: SQLAlchemy ORM or text() with bound params — no f-string SQL
    DB-->>Service: [Model / Result]
    Service-->>View: [ReturnType]
    Note over View: Serialises with [jsonify / schema.dump]; sets [status code]
    View-->>Client: HTTP [200/201/400/401] {[ResponsePayload]}
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
