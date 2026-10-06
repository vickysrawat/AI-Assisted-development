<!-- TEMPLATE -->
# Architecture — Request Flows

> Load this file when tracing how a request moves through the Django app,
> or when changing behaviour that spans multiple layers.

## Call Chains

### [View/Endpoint Name — e.g. "POST /api/orders/"]

> What this endpoint does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as Django Middleware
    participant URLConf as urls.py / DRF Router
    participant View as [ViewName] / [ViewSetName]
    participant Serializer as [SerializerName]
    participant Service as [ServiceName / Manager]
    participant DB as Database / ORM

    Client->>Middleware: [HTTP METHOD] /[route] {[Payload]}
    Note over Middleware: [AuthenticationMiddleware / SessionMiddleware] — validates [session / JWT]
    Middleware->>URLConf: Matches URL pattern, dispatches to view
    URLConf->>View: [view_function / ViewSet.action](request, *args, **kwargs)
    Note over View: [permission_classes] checked — [IsAuthenticated / IsOwner]
    View->>Serializer: [SerializerName](data=request.data)
    Note over Serializer: .is_valid() — validates fields, runs [validate_<field> hooks]
    Serializer->>Service: [perform_create / service_method](validated_data)
    Note over Service: Business logic — [what it does, e.g. "creates order, sends notification"]
    Service->>DB: [Model.objects.create / filter / update](parameterised)
    DB-->>Service: [Model instance / QuerySet]
    Service-->>Serializer: [Model instance]
    Serializer-->>View: Serialised data dict
    Note over View: Wraps in Response with [status.HTTP_201_CREATED / 200]
    View-->>Client: HTTP [200/201/400/403] {[ResponsePayload]}
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
