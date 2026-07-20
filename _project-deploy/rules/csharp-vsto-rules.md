---
paths: ["**/*.cs", "**/ThisAddIn.cs", "**/Ribbon*.cs", "**/ThisWorkbook.cs", "**/ThisDocument.cs"]
detect:
  files: ["**/ThisAddIn.cs", "**/ThisWorkbook.cs", "**/ThisDocument.cs"]
---

# VSTO / C# Rules — Applied to Visual Studio Tools for Office projects

Applies to Excel/Word/Outlook/PowerPoint add-ins and document-level customizations
built with VSTO on .NET Framework 4.x.

## COM Object Lifecycle

- Every COM object obtained from the Office object model must be assigned to a named
  variable and released via `Marshal.ReleaseComObject` in a finally block — never rely
  on GC to release COM objects
- Use the two-call pattern for Range and similar objects:
  ```csharp
  do { refCount = Marshal.ReleaseComObject(obj); } while (refCount > 0);
  ```
- Never use `foreach` over COM collections — iterate with an index-based loop and
  release each element individually
- Never chain COM object access (`Application.ActiveWorkbook.Sheets[1]`) — assign
  each intermediate object to a variable so it can be released

## Add-in Lifecycle

- Wire all Office event subscriptions in `ThisAddIn_Startup`; unsubscribe every handler
  in `ThisAddIn_Shutdown` — an unsubscribed event holds a COM reference that prevents
  Office from closing cleanly
- Never perform blocking operations (network calls, file I/O, DB queries) in
  `ThisAddIn_Startup` — Office enforces a startup timeout; defer to a background task
  if needed, but marshal results back to the UI thread before touching any Office object
- `ThisAddIn_Shutdown` must be defensive — wrap each unsubscribe/release in a try/catch;
  Office may already be partially torn down

## Thread Safety

- All Office object model calls must execute on the UI thread — never call from
  `Task.Run`, `ThreadPool`, `BackgroundWorker`, or async continuations without
  marshalling via `SynchronizationContext.Current.Post` or `Application.Dispatcher.Invoke`
- `async void` event handlers are acceptable only for Ribbon callbacks — always
  marshal Office calls back to the captured sync context
- Never use `Thread.Sleep` on the UI thread inside Office event handlers or Startup

## Ribbon

- Derive ribbon classes from `Microsoft.Office.Tools.Ribbon.RibbonBase` — never from
  the raw COM `IRibbonUI` interface
- Do not `new` a Ribbon class directly — access via `Globals.Ribbons.{RibbonClassName}`
- Ribbon callbacks must be `public` methods with the exact signature expected by the XML
  (`sender` is `RibbonButton`, `RibbonToggleButton`, etc. — not `object`)
- Invalidate ribbon controls via `RibbonUI.InvalidateControl(id)`, not by re-creating
  the ribbon

## TaskPane

- Create one `CustomTaskPane` per document/workbook, not one per add-in — track with
  a `Dictionary<Workbook, CustomTaskPane>` (or `Document` for Word)
- Dispose the `CustomTaskPane` and remove it from the dictionary when the document
  closes (`WorkbookBeforeClose` / `DocumentBeforeClose` event)
- Never store a reference to the host `Window` object beyond the event handler — it
  becomes invalid when the window closes

## Testing

- Mock all `Microsoft.Office.Interop.*` interfaces with Moq — never automate a live
  Office process in unit tests; live automation is fragile, slow, and requires Office
  to be installed on the build agent
- Verify `Marshal.ReleaseComObject` call count via mock verifications
- Test Startup/Shutdown pairing: every Subscribe call must have a matching Unsubscribe
  assertion in the Shutdown test

## Security

- Never store credentials, connection strings, or API keys in `app.config` committed
  to source — use Windows Credential Manager (`CredentialCache.DefaultNetworkCredentials`)
  or per-user isolated storage with encryption
- Never set `Application.AutomationSecurity = MsoAutomationSecurity.msoAutomationSecurityLow`
  — this disables VBA macro security globally for the user's Office session
- ClickOnce deployment provider URL must use HTTPS — HTTP exposes the manifest to MITM
  substitution

## File Naming

- Files: `PascalCase.cs` (e.g. `ExportService.cs`, `RibbonExport.cs`)
- Ribbon files: `{Feature}Ribbon.cs` + `{Feature}Ribbon.xml`
- TaskPane controls: `{Feature}TaskPane.cs` (WinForms) or `{Feature}TaskPane.xaml.cs` (WPF)
