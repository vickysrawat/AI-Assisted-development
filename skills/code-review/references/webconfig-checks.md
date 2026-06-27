# web.config / app.config Security Checks
_Reference v1.0 · Used by: code-review (Phase D), security · Build-free — always available_

For ASP.NET Framework estates, config-level misconfigurations are frequently
higher-yield than code-level findings. These checks parse XML — no toolchain,
no build, deterministic. Fingerprint: `check-id|file|xpath`.

| ID | Check | Severity | Detection (XPath/condition) |
|---|---|---|---|
| WC001 | Debug compilation enabled | High | `system.web/compilation/@debug = "true"` |
| WC002 | Custom errors off (stack traces leak) | High | `system.web/customErrors/@mode = "Off"` |
| WC003 | Request validation disabled | Critical | `pages/@validateRequest = "false"` or `httpRuntime/@requestValidationMode < 4.0` |
| WC004 | ViewState MAC disabled | Critical | `pages/@enableViewStateMac = "false"` |
| WC005 | Connection string with inline password | Critical | `connectionStrings/add/@connectionString` matches `password=` (and not `Integrated Security`) |
| WC006 | Cookies not HttpOnly | Medium | `system.web/httpCookies/@httpOnlyCookies != "true"` |
| WC007 | Cookies not Secure (SSL site) | High | `httpCookies/@requireSSL != "true"` when deployment profile says HTTPS |
| WC008 | Trace enabled | High | `system.web/trace/@enabled = "true"` |
| WC009 | Weak machineKey (explicit weak algos) | High | `machineKey/@validation` in (MD5, SHA1) or `@decryption = "DES"` |
| WC010 | Forms auth without SSL | High | `forms/@requireSSL = "false"` |
| WC011 | Forms auth long/sliding timeout | Medium | `forms/@timeout > 60` with `@slidingExpiration = "true"` |
| WC012 | Directory browsing enabled | Medium | `system.webServer/directoryBrowse/@enabled = "true"` |
| WC013 | Verbose IIS errors to remote users | Medium | `httpErrors/@errorMode = "Detailed"` |
| WC014 | Header disclosure (X-Powered-By etc.) | Low | `customHeaders` does not remove `X-Powered-By`; `@enableVersionHeader != "false"` |
| WC015 | Unencrypted sensitive sections | High | `appSettings`/`connectionStrings` containing secret-shaped values without `configProtectionProvider` |

Notes:
- Transform files (`web.Release.config`) must be checked too — a safe base
  config with a transform that re-enables debug is a common false-clean.
- WC005/WC015 overlap with the existing secrets scan in `checkin` Check C —
  fingerprints here use the WCxxx ID so reconciliation keeps them distinct;
  do not double-gate the same line.
- B1–B7 escalation applies: any WC finding on an app handling privileged or
  immigration data escalates one severity band (Phase P annotates, per the
  disagreement protocol).
- All findings: `Source: deterministic (webconfig-checks 1.0)`.
