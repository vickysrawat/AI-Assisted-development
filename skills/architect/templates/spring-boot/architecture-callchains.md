<!-- TEMPLATE -->
# Architecture — Request Flows

> Load this file when tracing how a request moves through the Spring Boot app,
> or when changing behaviour that spans multiple layers.

## Call Chains

### [Endpoint Name] — [HTTP METHOD] /[route]

> What this endpoint does: [one-sentence description of business purpose]

```mermaid
sequenceDiagram
    participant Client
    participant Filter as Spring Security Filter Chain
    participant Controller as @RestController [ControllerName]
    participant Service as @Service [ServiceName]
    participant Repository as @Repository [RepositoryName]
    participant DB as Database

    Client->>Filter: [HTTP METHOD] /[route] {[RequestDto]}
    Note over Filter: JWT validation, populates SecurityContext with [roles]
    Filter->>Controller: [handlerMethod](@Valid @RequestBody [RequestDto])
    Note over Controller: @Valid binding — throws MethodArgumentNotValidException on failure
    Controller->>Service: [method]([ServiceParam])
    Note over Service: Business logic — [what it does]; @Transactional boundary starts here
    Service->>Repository: [findBy / save / deleteBy](params)
    Note over Repository: JPQL / derived query — returns Optional or List
    Repository->>DB: SELECT / INSERT / UPDATE [Table]
    DB-->>Repository: Entity / rows affected
    Repository-->>Service: [EntityType] / Optional.empty()
    Note over Service: Maps entity → [ResponseDto]; transaction commits
    Service-->>Controller: [ResponseDto]
    Controller-->>Client: ResponseEntity<[ResponseDto]> [200/201/400/404]
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
