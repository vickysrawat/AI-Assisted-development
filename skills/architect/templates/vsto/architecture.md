<!-- TEMPLATE -->
# Architecture

> Load this file for system-wide orientation: stack, layer responsibilities,
> module map, and the two Mermaid diagrams.

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Office host | | |
| .NET Framework version | | |
| Add-in type | Add-in / Document customization | |
| VSTO version | | |
| Ribbon | Yes / No | |
| TaskPane | Yes / No | |
| Auth / identity | | |
| External API calls | Yes / No | |
| Data persistence | | |

## Solution Structure

| Project | Path | Purpose |
|---|---|---|

## Add-in / Customization Lifecycle

### Startup (`ThisAddIn_Startup` / `ThisWorkbook_Startup`)

| Action | Detail |
|---|---|
| Events subscribed | |
| Services initialized | |
| Ribbon registered | |
| TaskPane created | |

### Shutdown (`ThisAddIn_Shutdown` / `ThisWorkbook_Shutdown`)

| Action | Detail |
|---|---|
| Events unsubscribed | |
| TaskPanes disposed | |
| COM objects released | |

## Host Application Integration

| Globals accessor | Type | Purpose |
|---|---|---|
| `Globals.ThisAddIn` | | |
| `Globals.Ribbons.*` | | |

## End-to-End Architecture

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    User["Office User"] --> Ribbon["Ribbon / UI Event"]
    Ribbon --> Handler["Event Handler"]
    Handler --> Service["Service Layer"]
    Service --> OfficeOM["Office Object Model"]
    Service --> ExternalAPI["External API (if any)"]
    style User fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style Ribbon fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style Handler fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Service fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style OfficeOM fill:#E67E22,color:#ffffff,stroke:#A04000,stroke-width:2px
    style ExternalAPI fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
```

</div>

> ⚠ Could not determine — populate from actual codebase

## Layered View

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart TB
    UI["Ribbon / TaskPane / Document Events"]
    Services["Service Layer"]
    OfficeOM["Office Object Model (COM Interop)"]
    Data["Data / Settings Storage"]

    UI --> Services
    Services --> OfficeOM
    Services --> Data
    style UI fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style Services fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style OfficeOM fill:#E67E22,color:#ffffff,stroke:#A04000,stroke-width:2px
    style Data fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
```

</div>

> ⚠ Could not determine — populate from actual codebase
