# Prompts — VSTO (Visual Studio Tools for Office)

---

## File 1 Prompt — architecture.md

You are a software architect documenting a VSTO Office add-in or document-level customization.
Read in order: the .sln file, all .csproj files, `ThisAddIn.cs` (or `ThisWorkbook.cs` /
`ThisDocument.cs`), any Ribbon .cs files, app.config, and the top-level folder structure.

Populate architecture.md completely:

**Technology Stack** — Office host application (Excel/Word/Outlook/PowerPoint), .NET Framework
version (from `TargetFrameworkVersion` in csproj), add-in type (VSTO shared add-in vs
document-level customization), VSTO runtime version, Ribbon present (yes/no), TaskPane
present (yes/no), external API calls (yes/no), data persistence approach (isolated storage,
registry, SharePoint, SQL), NuGet packages for Office interop.

**Solution Structure** — list every project with folder path and one-line purpose.

**Add-in Lifecycle** — read `ThisAddIn_Startup` / `ThisAddIn_Shutdown` (or Workbook/Document
equivalents). List every event subscription wired in Startup and confirm it is unsubscribed
in Shutdown. List services initialized and TaskPanes created.

**Host Application Integration** — document `Globals.ThisAddIn`, `Globals.Ribbons.*`, and
`Globals.ThisWorkbook` / `Globals.ThisDocument` access points actually used.

**End-to-End Architecture** — Mermaid `flowchart LR`: Office User → Ribbon/UI Event →
Event Handler → Service Layer → Office Object Model → External services (if any).

**Layered View** — Mermaid `flowchart TB` showing actual layers: UI (Ribbon/TaskPane/Events),
Services, Office OM (COM Interop), Data/Settings.

Every fact must come from source files.
Sections that cannot be determined: `> ⚠ Could not determine — needs manual input`

---

## File 2 Prompt — architecture-flows.md

You are documenting interaction flows through a VSTO Office add-in.

For each Ribbon callback: trace the call chain from the ribbon event handler through the
service layer to the Office object model, noting every COM object obtained and its release.

For each document/workbook event handler: trace the handler through its call chain.

For each flow document:
- Entry point (Ribbon button id / event name)
- Every method call in sequence with class names
- COM objects obtained and their release (Marshal.ReleaseComObject calls)
- Any external HTTP calls
- Thread context (UI thread required for all OM calls)

**TaskPane Lifecycle** — how TaskPanes are created (on document open / on Ribbon click),
tracked (dictionary key type), shown/hidden, and disposed.

**COM Disposal Chains** — for the 2-3 most complex operations, show the complete sequence
of COM objects obtained and released.

Read actual code files — do not infer from naming conventions.
Mark incomplete traces: `> ⚠ Partial trace — review manually`

---

## File 3 Prompt — architecture-reference.md

You are documenting reference data for a VSTO Office add-in.

**NuGet / PIA Package Versions** — read all packages.config files or csproj PackageReference
elements. List every `Microsoft.Office.*` package with version and project.

**Supported Office Versions** — read the `TargetOfficeVersion` property in csproj and any
version checks in code. List which Office versions are explicitly supported and tested.

**Office Bitness** — read csproj Platform target (AnyCPU / x86 / x64). Note whether
both 32-bit and 64-bit Office are supported.

**ClickOnce / Deployment** — find .application manifest files. Extract: deployment provider
URL, minimumRequiredVersion, updateEnabled, deployFromWeb. List any .pfx signing
certificate references in csproj (ManifestKeyFile, ManifestCertificateThumbprint).

**CI/CD Pipelines** — for each pipeline file: name, trigger, whether it signs and
publishes the ClickOnce manifest.

**app.config Keys** — list every `<appSettings>` key (use placeholder for secret-looking values).

---

## File 1 addendum — architecture.md diagrams

In addition to the sections above, `architecture.md` MUST contain two Mermaid diagrams:

- **`## End-to-End Architecture`** — a `flowchart LR`: Office User → Ribbon/UI Event →
  Handler → Service → Office Object Model → external services (if any). Label edges with
  the event type or method name where known. Only include nodes confirmed from source.
- **`## Layered View`** — a `flowchart TB` of the real layers with dependency direction,
  derived from actual class/namespace references.

Emit valid fenced ` ```mermaid ` blocks; keep node labels short, free of `()[]{}`. If a
diagram cannot be determined, keep the `> ⚠ Could not determine — needs manual input` marker.

---

## File 4 Prompt — architecture-data.md

Document the data and settings model for this VSTO add-in.

- **Settings Storage** — where does the add-in persist user preferences or state?
  (isolated storage, Windows registry via `Microsoft.Win32.Registry`, SharePoint lists,
  SQL database, app.config, or none). Document the storage location and key structure.
- **Document-embedded Data** — if the add-in reads/writes CustomXMLParts, document
  properties, named ranges, or defined names, document each with its purpose.
- **External Data** — if the add-in calls external APIs or databases, document the
  data exchanged: entity names, key fields, ownership.
- **Sensitive Data** — identify any PII, credentials, or B1–B7 sensitive data handled.

Every fact from source. Undetectable → `> ⚠ Could not determine — needs manual input`.

---

## File 5 Prompt — architecture-integrations.md

Catalogue external dependencies for this VSTO add-in.

- **External API Calls** — any `HttpClient`, `WebClient`, or WCF client calls: endpoint,
  auth method, timeout, retry policy.
- **Office Services** — SharePoint / OneDrive integration if present.
- **Windows Services** — Windows Credential Manager, registry, file system paths.
- **Failure Behavior** — per-dependency: what happens when it fails (exception surfaced to
  user, silent fallback, cached data used)?

Never invent timeouts, SLAs, or owners. Extract only what code shows; flag the rest.

---

## File 6 Prompt — architecture-security.md

Document the security model for this VSTO add-in.

- **Trust Model** — how the add-in is trusted: ClickOnce trust prompt, Inclusion List,
  Group Policy, code signing certificate authority.
- **Code Signing** — certificate type (self-signed / CA / EV), where the .pfx is stored,
  how it is protected in CI/CD.
- **Data Protection** — how sensitive data (credentials, settings, document data) is
  protected at rest and in transit.
- **ClickOnce Security** — whether the deployment provider URL uses HTTPS; whether
  `minimumRequiredVersion` is set to prevent rollback attacks.
- **COM Trust** — whether the add-in calls `Marshal.GetActiveObject` or
  `Activator.CreateInstance` with external type identifiers (COM hijack risk).
- **Macro Trust** — whether `Application.AutomationSecurity` is modified; if so, document
  when and why.

Do NOT invent authorization rules or protections not present in code — flag gaps.

---

## File 7 Prompt — architecture-decisions.md (SEED ONLY)

Seed the decision log with 3–5 non-obvious architectural choices detected from the codebase.
Examples for VSTO: why document-level vs add-in approach, why ClickOnce vs MSI deployment,
why WinForms vs WPF for TaskPane, why isolated storage vs registry for settings.

For each detected choice: **Decision** (from code/config), **Rationale** =
`> ⚠ Could not determine — needs manual input`, **Alternatives rejected** (from code patterns),
**Date** = `unknown` unless evidenced, **Status** = `Accepted`.

**If the file already contains real `AD-NNN` entries with filled rationale, do not modify it.**
