# Windows Authentication (NTLM / Negotiate) — potential blocker

NTLM is a built-in ZAP authentication method, but it is **unreliable headless in Docker** —
a context that works in the ZAP Desktop GUI frequently fails in the container. Treat
Windows Auth as a special case and present the user a choice before scanning.

## Option 1 — Configure and test in ZAP Desktop, then export the context (recommended)

The ZAP docs explicitly recommend configuring authentication in the Desktop GUI, testing
it in place, then exporting the context for use in an Automation Framework plan. The auth
elements cannot be edited via the AF GUI but are preserved as long as you do not delete the
context.

1. In ZAP Desktop: Session Properties → Context → Authentication → HTTP/NTLM Authentication.
2. Set hostname, port, realm (e.g. `DOMAIN\\user`), add the user, enable Forced User Mode.
3. Verify it works against an authenticated page in the GUI.
4. Export the context (`.context`) and reference it from the plan.

## Option 2 — Basic auth fallback

If the IIS app also accepts HTTP Basic auth, use that instead of NTLM:
```bash
export ZAP_AUTH_HEADER_VALUE="Basic $(printf 'user:pass' | base64)"
```

## Option 3 — Pre-authenticated session cookie (only viable headless path for CI)

1. Log into the app in a browser, copy the authenticated session cookie.
2. Inject it on every ZAP request via a replacer rule or `ZAP_AUTH_HEADER_VALUE`.
3. The cookie expires — fine for a one-shot scan, fragile for long runs.

## What the skill should do

- Detect IIS + Windows Auth in Step 0e and STOP.
- Present these three options.
- If the user has no Desktop ZAP and the app is NTLM-only with no Basic fallback, tell them
  plainly that a fully headless Docker scan is not reliable for this target, and Option 1
  (Desktop) is the supported path. Do not pretend otherwise.
