# Coverity Checkers — VSTO / Office Add-in

## RESOURCE_LEAK — COM Object Not Released

| Pattern | Checker | Example |
|---|---|---|
| COM object obtained from Office OM without `Marshal.ReleaseComObject` in finally | RESOURCE_LEAK | `var ws = wb.Sheets[1]; ws.DoWork();` — no release |
| COM collection iterated with `foreach` without per-element release | RESOURCE_LEAK | `foreach (Worksheet ws in wb.Worksheets)` |
| Chained COM access: `Application.ActiveWorkbook.Sheets[1].Range["A1"]` | RESOURCE_LEAK | Intermediate objects (Workbook, Sheets, Worksheet) never assigned or released |
| `CustomTaskPane` created but dictionary entry not removed on document close | RESOURCE_LEAK | TaskPane tracks across documents but `WorkbookBeforeClose` handler missing |
| `Marshal.ReleaseComObject` called once on a Range — should loop until refCount == 0 | RESOURCE_LEAK | `Marshal.ReleaseComObject(range)` (single call, refCount may still be > 0) |

**COM disposal pattern (correct):**
```csharp
Excel.Range range = null;
try
{
    range = worksheet.Range["A1:D10"];
    // ... use range ...
}
finally
{
    if (range != null)
    {
        int rc;
        do { rc = Marshal.ReleaseComObject(range); } while (rc > 0);
    }
}
```

## THREAD_SAFETY — Office Object Model Off UI Thread

| Pattern | Checker | Risk |
|---|---|---|
| `Application.*` / `Workbook.*` / `Worksheet.*` called inside `Task.Run(...)` | THREAD_SAFETY | COM apartment violation — Office OM must be called from the STA UI thread |
| `Application.*` called inside `ThreadPool.QueueUserWorkItem` | THREAD_SAFETY | Same — MTA thread cannot call STA COM objects |
| `await` continuation touching Office OM without `SynchronizationContext` capture | THREAD_SAFETY | After `await`, execution may resume on a ThreadPool thread |
| `BackgroundWorker.DoWork` event handler calling Office OM | THREAD_SAFETY | DoWork runs on ThreadPool thread |
| `Thread.Sleep` in `ThisAddIn_Startup` | THREAD_SAFETY | Blocks Office initialization; may trigger startup timeout |

**Correct async pattern:**
```csharp
private async void RibbonButton_Click(object sender, RibbonControlEventArgs e)
{
    var ctx = SynchronizationContext.Current; // capture UI thread context
    var result = await Task.Run(() => DoHeavyWork());
    ctx.Post(_ =>
    {
        // safe to call Office OM here — back on UI thread
        Globals.ThisAddIn.Application.ActiveCell.Value = result;
    }, null);
}
```

## MEMORY_LEAK — Unsubscribed Office Event Handlers

| Pattern | Checker | Risk |
|---|---|---|
| Event subscribed in `ThisAddIn_Startup` with no matching unsubscribe in `ThisAddIn_Shutdown` | MEMORY_LEAK | COM reference held; prevents Office from closing cleanly |
| `WorkbookBeforeClose` / `DocumentBeforeClose` handler subscribed once but not per-document | MEMORY_LEAK | Handler fires for wrong document after first close |
| `Application.SheetChange` subscribed without corresponding `Application.SheetChange -=` | MEMORY_LEAK | Accumulates if add-in is hot-reloaded |

## API_MISUSE — VSTO Programming Model Violations

| Pattern | Checker | Detail | Fix |
|---|---|---|---|
| `Application.OnTime` set without a cancel call in `ThisAddIn_Shutdown` | API_MISUSE | OnTime fires after Office starts closing — causes crash | Store OnTime procedure name; call `Application.OnTime(..., Schedule: false)` in Shutdown |
| `dynamic` used to access a COM object without null guard | NULL_RETURNS | `dynamic cell = range.Value;` — Value can be null/DBNull for empty cells | Check `cell != null && !(cell is DBNull)` before use |
| Ribbon class instantiated with `new` instead of `Globals.Ribbons.*` | API_MISUSE | Creates a second ribbon not wired to Office | Always use `Globals.Ribbons.{ClassName}` |
| `CustomTaskPane` created as a singleton instead of per-document | API_MISUSE | Single pane shared across all workbooks — shows wrong data in multi-workbook scenario | Use `Dictionary<Workbook, CustomTaskPane>` |

## LOGIC_ERROR — Brittle Office Object References

| Pattern | Checker | Risk |
|---|---|---|
| Hardcoded worksheet name: `wb.Sheets["Sheet1"]` | LOGIC_ERROR | Breaks if user renames the sheet |
| Hardcoded range address: `ws.Range["A1:D10"]` | LOGIC_ERROR | Breaks if user inserts rows/columns above the range |
| Hardcoded column index: `ws.Columns[3]` | LOGIC_ERROR | Breaks if columns are rearranged |
| Comparing `range.Address` string without `$` normalization | LOGIC_ERROR | `A1` vs `$A$1` are the same cell but string equality fails |

**Preferred patterns:**
- Use named ranges (`wb.Names["MyDataRange"]`) instead of hardcoded addresses
- Use `ListObject` (Excel table) objects which survive row/column changes

## SECURITY — VSTO-Specific

| Pattern | Checker | Risk |
|---|---|---|
| `Application.AutomationSecurity = MsoAutomationSecurity.msoAutomationSecurityLow` | TAINTED_* | Disables VBA macro security globally for the user's Office session |
| HTTP (not HTTPS) in ClickOnce `deploymentProvider` URL | TAINTED_* | Manifest susceptible to MITM substitution — attacker can serve malicious add-in |
| `ServicePointManager.ServerCertificateValidationCallback = delegate { return true; }` | TAINTED_* | Disables TLS certificate validation — all HTTPS calls are MITM-vulnerable |
| Credentials stored in `app.config` `<appSettings>` | TAINTED_* | Config file is readable by any process running as the user |
| `Marshal.GetActiveObject("Excel.Application")` with untrusted class identifier | TAINTED_DESERIALIZE | COM hijack risk if class ID is attacker-controlled |
