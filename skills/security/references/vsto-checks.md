# Security Checks — VSTO / Office Add-in

Pass 1 patterns specific to VSTO add-ins and Office document customizations.
Load this file in addition to `pass1-patterns.md` when VSTO is detected.

---

## COM Trust and Privilege

| Pattern | Risk | Checker |
|---|---|---|
| `Marshal.GetActiveObject("Excel.Application")` — COM moniker is attacker-controllable | COM hijack: attacker registers a rogue COM server under the same ProgID | TAINTED_DESERIALIZE |
| `Activator.CreateInstance(Type.GetTypeFromProgID(userInput))` | Arbitrary COM object instantiation from user-supplied ProgID | TAINTED_DESERIALIZE |
| `Marshal.GetActiveObject` called with a string from app.config / environment variable | Config-controlled COM activation — attacker who controls config controls the COM server | TAINTED_DESERIALIZE |
| Add-in runs with elevated COMplus security level without explicit justification | COM calls inherit the add-in's privilege level inside the Office process | API_MISUSE |

**Note on COM trust:** VSTO add-ins execute inside the Office host process and inherit its
privileges. Any COM object obtained via `GetActiveObject` or `CreateInstance` that is not
from the well-known `Microsoft.Office.Interop` assemblies should be flagged.

---

## ClickOnce Deployment Security

| Pattern | Risk | Checker |
|---|---|---|
| `<deploymentProvider codebase="http://...">` — HTTP not HTTPS | MITM substitution: attacker on the network serves a malicious manifest or DLL | TAINTED_* |
| `minimumRequiredVersion` not set or set to 0.0.0.0 | Rollback attack: user can be directed to install an older vulnerable version | API_MISUSE |
| ClickOnce manifest not code-signed (`<publisherIdentity>` absent) | User receives no trust prompt — any unsigned manifest is accepted if trust was granted once | API_MISUSE |
| `.pfx` file committed to source repository | Private key exposure: anyone with repo access can sign a malicious add-in | TAINTED_* |

---

## Code Signing

| Pattern | Risk | Checker |
|---|---|---|
| Self-signed certificate used in production deployment | Users see "Unknown Publisher" prompt; any attacker can generate the same self-signed cert and users may accept it | API_MISUSE |
| Certificate expiry within 30 days | Expired cert causes Office to block the add-in silently or show security warnings | API_MISUSE |
| Signing bypassed in release build (`<SignAssembly>false</SignAssembly>` in Release config) | Unsigned assembly shipped — ClickOnce manifest hash mismatch or no trust anchor | API_MISUSE |

---

## Macro and Automation Security

| Pattern | Risk | Checker |
|---|---|---|
| `Application.AutomationSecurity = MsoAutomationSecurity.msoAutomationSecurityLow` | Disables VBA macro security globally for the entire Office session — any macro in any document runs without prompt | TAINTED_* |
| `Application.AutomationSecurity` set and never restored to the previous value | Security level remains lowered after the add-in operation completes | LOGIC_ERROR |
| `Application.DisplayAlerts = false` left set in error paths | Suppresses Office security dialogs including macro trust prompts | API_MISUSE |

**Safe pattern:**
```csharp
var previous = app.AutomationSecurity;
app.AutomationSecurity = MsoAutomationSecurity.msoAutomationSecurityForceDisable;
try { /* controlled operation */ }
finally { app.AutomationSecurity = previous; }
```

---

## Data Exfiltration via Office Object Model

| Pattern | Risk | Checker |
|---|---|---|
| `workbook.SaveCopyAs(userControlledPath)` without path validation | Path traversal: attacker-controlled path can write the workbook anywhere accessible to the user | TAINTED_PATH |
| `Application.ActiveWorkbook.Path` concatenated without validation | Path traversal in document-level customizations | TAINTED_PATH |
| `Range.Value` / `Cell.Value` written to an external HTTP endpoint without sanitization | Data exfiltration: workbook contents sent externally | TAINTED_* |
| `CustomDocumentProperties` used to store OAuth tokens or secrets | Document properties travel with the file — secrets exposed when file is shared | TAINTED_* |

---

## TLS / HTTP Security

| Pattern | Risk | Checker |
|---|---|---|
| `ServicePointManager.ServerCertificateValidationCallback = delegate { return true; }` | Disables TLS cert validation globally — all HTTPS calls in the process are MITM-vulnerable | TAINTED_* |
| `new WebClient().DownloadString("http://...")` — HTTP endpoint | Plaintext data transfer; traffic visible on network | TAINTED_* |
| `HttpClient` without explicit `Timeout` set | DoS via slow server: Office hangs while waiting | RESOURCE_LEAK |

---

## Sensitive Data in Storage

| Pattern | Risk | Checker |
|---|---|---|
| Credentials written to `IsolatedStorageFile` without encryption | Isolated storage is readable by any code running as the same Windows user | TAINTED_* |
| Connection strings in `app.config` `<appSettings>` committed to source | Plaintext credentials in version control | TAINTED_* |
| Registry writes to `HKEY_LOCAL_MACHINE` without elevation check | Operation will fail silently on per-user installs; may expose privilege escalation path | API_MISUSE |
