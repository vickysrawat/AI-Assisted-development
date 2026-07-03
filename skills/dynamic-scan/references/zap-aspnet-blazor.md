# Blazor — Dynamic Scan Notes

## Blazor Server
- Renders via SignalR/WebSocket. Use the **Ajax spider** for the initial HTTP surface.
- ZAP's standard scanner does NOT fuzz WebSocket messages — WS message tampering is a known
  coverage hole, deferred to v2. State this in the report rather than implying full coverage.
- Active scanning can corrupt the per-circuit server state; advise a fresh browser session
  after scanning.

## Blazor WASM
- Client-side .NET. Ajax spider for routes.
- Check whether `.dll` assemblies shipped to the browser embed secrets or sensitive business
  logic (download `/_framework/` assemblies and inspect).

## Auth
Cookie or Azure AD → `zap-auth.md`. Azure AD headless is not reliable (manual browser step).

## Key runtime risks
WebSocket message tampering (v2), circuit hijacking, sensitive logic in WASM assemblies,
token storage in browser.
