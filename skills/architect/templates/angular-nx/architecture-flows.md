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
    participant Component as [lib/feature][ComponentName]
    participant Facade as [lib/data-access][FacadeName]
    participant Effect as NgRx Effect / Signal Effect
    participant Service as [lib/data-access][ServiceName]
    participant API as Backend API

    User->>Router: Navigate to /[route]
    Note over Router: Resolves guards ([AuthGuard]), activates route in [app-name]
    Router->>Component: Activates, passes [ActivatedRoute] params
    Note over Component: Reads store/signals via [FacadeName], dispatches action or calls facade method
    Component->>Facade: [methodName]([params])
    Note over Facade: Dispatches [ActionName] to NgRx store / triggers signal update
    Facade->>Effect: [ActionName] triggers [EffectName]
    Note over Effect: Side-effect handler — calls service, maps to success/failure actions
    Effect->>Service: [methodName]([params])
    Note over Service: Constructs HTTP request — part of [lib/data-access]
    Service->>API: [HTTP METHOD] /[endpoint] {[RequestPayload]}
    API-->>Service: HTTP [200/400] [ResponsePayload]
    Service-->>Effect: Observable<[ResponseType]>
    Effect-->>Facade: Dispatches [ActionNameSuccess] or [ActionNameFailure]
    Note over Facade: Reducer updates store slice; selector emits new value
    Facade-->>Component: Observable<[ViewModelType]> / Signal<[ViewModelType]>
    Note over Component: Template re-renders with new data
    Component-->>User: Updated view — [what the user sees]
```

---

## Component Interaction Patterns

## HTTP Interceptors

| Interceptor | Purpose | Order |
|------------|---------|-------|

## Service Dependency Graph

| Service | Injects |
|---------|---------|
