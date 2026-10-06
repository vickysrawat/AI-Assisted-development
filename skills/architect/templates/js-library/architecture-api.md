<!-- TEMPLATE -->
# Architecture — Public API

> Load this file when implementing against or extending this library.

## Functions

### `functionName(params): ReturnType`

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|

**Returns:**

**Side Effects:**

**Throws:**

**Usage flow:**

```mermaid
sequenceDiagram
    participant Consumer as Consumer Code
    participant Lib as [LibraryName].[functionName]
    participant Internal as Internal Helper (if any)

    Consumer->>Lib: functionName([params])
    Note over Lib: Validates [params] — throws [ErrorType] if invalid
    Lib->>Internal: [helperCall]([args])
    Note over Internal: [What the helper does]
    Internal-->>Lib: [InternalResult]
    Note over Lib: Transforms result — [what transformation]
    Lib-->>Consumer: [ReturnType]
```

---

## Classes

### `ClassName`

**Constructor:**

**Public Methods:**

**Public Properties:**

**Lifecycle flow:**

```mermaid
sequenceDiagram
    participant Consumer as Consumer Code
    participant Instance as [ClassName] instance
    participant External as External System (if any)

    Consumer->>Instance: new [ClassName](config)
    Note over Instance: Initialises [internal state / connection / cache]
    Consumer->>Instance: [methodName]([params])
    Note over Instance: [What the method does — validates, transforms, delegates]
    Instance->>External: [external call — e.g. HTTP, file I/O]
    External-->>Instance: Result
    Instance-->>Consumer: [ReturnType]
    Consumer->>Instance: [dispose / close / destroy]()
    Note over Instance: Releases [resources / connections / subscriptions]
```

---

## Types & Interfaces

---

## Usage Patterns

### Basic Setup

```typescript
// example
```

### Common Usage Examples

---

## Known Gotchas
