<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a user journey, debugging data fetching,
> or understanding component composition patterns.

## User Journey Flows

### [Journey Name — e.g. "User submits checkout form"]

> What this flow does: [one-sentence description of the user action and outcome]

```mermaid
sequenceDiagram
    participant User
    participant Router as React Router
    participant Page as [PageComponent]
    participant Component as [ChildComponent]
    participant Hook as [useHookName]
    participant API as Backend API

    User->>Router: Navigate to /[route]
    Note over Router: Matches route, renders [PageComponent] — [lazy-loaded / eager]
    Router->>Page: Mount [PageComponent] with [props / params]
    Note over Page: Renders [ChildComponent], passes [props]; wraps with [ErrorBoundary / Suspense]
    Page->>Component: [prop] passed down / context consumed
    Note over Component: User triggers [onClick / onSubmit / onChange]
    Component->>Hook: [methodName]([params]) or [dispatch(action)]
    Note over Hook: [useState / useReducer / useQuery / useMutation] — manages [loading, data, error]
    Hook->>API: [HTTP METHOD] /[endpoint] {[RequestPayload]}
    Note over API: [Authorization: Bearer] header applied by [axios interceptor / fetch wrapper]
    API-->>Hook: HTTP [200/201/400] {[ResponsePayload]}
    Note over Hook: Updates [state / cache (React Query)] — triggers re-render
    Hook-->>Component: { data, isLoading, error }
    Note over Component: Conditional render — [loading spinner / error message / success view]
    Component-->>User: Updated UI — [what the user sees]
```

---

## Custom Hooks Inventory

| Hook | Encapsulates | Returns | Used by |
|------|-------------|---------|---------|

## Data Fetching Pattern

## Component Composition Patterns
