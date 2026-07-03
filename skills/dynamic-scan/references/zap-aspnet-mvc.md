# ASP.NET MVC / Razor Pages — Dynamic Scan Notes

Server-rendered HTML, so the **traditional spider** (not Ajax) discovers links.

## Antiforgery / CSRF tokens
MVC forms and Razor Pages emit `__RequestVerificationToken`. Add this token name in ZAP's
Anti-CSRF options so ZAP extracts it from the form and replays it on POST; otherwise every
state-changing request returns 400 and coverage collapses.

## ViewState (Web Forms legacy)
If `__VIEWSTATE` is present, treat it as opaque during spidering. Only the active scanner
should probe it. Tampering during spider breaks navigation.

## Route seeding
Seed the spider with conventional routes `{controller}/{action}/{id}` plus any attribute
routes extracted in Step 2 (`route-extraction.md`). MVC areas (`/Area/Controller/Action`)
are easy to miss — extract `[Area]` attributes too.

## Razor injection
Flag `@Html.Raw(...)` on user-controlled data as an XSS risk in the source-mapping step.

## Windows Auth
Internal MVC apps on IIS commonly use Windows Auth → see `zap-windows-auth.md` (blocker check).

## Key runtime risks to confirm
CSRF on POST handlers, open redirects in `returnUrl`, IDOR on `id` route params,
unvalidated model binding (over-posting / mass assignment via `[Bind]` gaps),
verbose error pages leaking stack traces.
