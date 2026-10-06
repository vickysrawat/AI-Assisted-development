<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a user journey, debugging a data flow,
> or understanding component interaction patterns.

## User Journey Flows

### [Journey Name — e.g. "User submits search form"]

> What this flow does: [one-sentence description of the user action and outcome]

```mermaid
sequenceDiagram
    participant User
    participant Router as Angular Router
    participant Component as [ComponentName]
    participant Service as [ServiceName]
    participant Interceptor as HTTP Interceptor
    participant API as Backend API

    User->>Router: Navigate to /[route]
    Note over Router: Resolves guards ([AuthGuard]), activates route
    Router->>Component: Activates component, passes [ActivatedRoute] params
    Note over Component: ngOnInit — subscribes to [observable], initialises [formGroup / state]
    Component->>Service: [methodName]([params])
    Note over Service: Constructs [HttpRequest], applies [operators — map/catchError]
    Service->>Interceptor: Outgoing request
    Note over Interceptor: Attaches [Authorization / XSRF] header
    Interceptor->>API: [HTTP METHOD] /[endpoint] {[RequestPayload]}
    API-->>Interceptor: HTTP [200/400/401] [ResponsePayload]
    Note over Interceptor: Handles [401 → refresh token / 5xx → global error]
    Interceptor-->>Service: Observable<[ResponseType]>
    Service-->>Component: Observable<[MappedType]>
    Note over Component: Updates [property / signal], triggers change detection
    Component-->>User: Re-rendered view — [what the user sees]
```

---

## Component Interaction Patterns

## HTTP Interceptors

| Interceptor | Purpose | Order |
|------------|---------|-------|

## Service Dependency Graph

| Service | Injects |
|---------|---------|
