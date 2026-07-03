# Tech Spec Overlay — ASP.NET MVC + jQuery / Bootstrap
# Stack: dotnet / dotnet-framework + Angular absent (jQuery UI present)
#
# Replaces the framework-specific sections in techspec-base.md.
# Use when detected_stacks contains dotnet or dotnet-framework
# AND angular is NOT present.
#
# Pattern: thin MVC controller → interface → service → view (Razor + jQuery)

---

## Files Changed

| # | File | Project | Change |
|---|---|---|---|
| 1 | {Controllers/XController.cs} | {KE.Project} | {Add/Modify action} |
| 2 | {Services/IXService.cs} | {KE.Project.Services} | {Add/Modify method} |
| 3 | {Services/XService.cs} | {KE.Project.Services} | {Implement method (stub/real)} |
| 4 | {Models/XModel.cs} | {KE.Project.Models} | {New DTO / Modify existing} |
| 5 | {Views/Area/Index.cshtml} | {KE.Project} | {Add UI component} |

> Locate files via the existing solution structure — do not invent paths.
> For DTOs, check if an existing model should be extended before creating new.
> For views, identify the correct partial or layout to modify.

### AC Traceability (populate after files are listed)

Every AC from the ICEA must map to at least one file. Every file must
satisfy at least one AC. See base template AC Coverage Matrix section.

---

## Controller Layer — {XController.cs}

Follow the existing controller pattern in this project. Keep actions thin:
validate input, delegate to service, return result. Never put business
logic in the controller.

```csharp
/// <summary>
/// {Action description} — AC-{Fx}
/// </summary>
[HttpGet] // or [HttpPost]
[ValidateAntiForgeryToken] // POST only — omit for GET
public async Task<IActionResult> {ActionName}({parameters})
{
    // Input guard
    if ({invalid condition})
        return {appropriate result — Json([]) / BadRequest() / RedirectToAction()};

    var result = await _{service}.{MethodAsync}({params});
    return {Json(result) / View(result) / RedirectToAction(...)};
}
```

**Auth:** `[Authorize]` inherited from controller class unless explicitly
overridden. Never add `[AllowAnonymous]` without explicit justification in
the ICEA security section.

**Anti-forgery:** Required on all POST/PUT/DELETE actions via
`[ValidateAntiForgeryToken]`. Not required on GET (read-only).

---

## Service Interface — {IXService.cs}

Add method signature to the existing interface. Signature must be
production-ready even if the implementation is a stub.

```csharp
/// <summary>
/// {Method description}.
/// Stub: {stub behaviour}. Swap body for real call — signature unchanged.
/// AC-{Fx}(stub) / AC-{Fx}-swap (real).
/// </summary>
Task<{ReturnType}> {MethodAsync}({parameters});
```

---

## Service Implementation — {XService.cs}

### Stub implementation (ships with this story)

```csharp
// STUB ADO-{ID} — replace with real {endpoint/operation} when {condition}.
// Swap criteria: {what must be confirmed before swapping} →
//   replace method body below → verify in non-prod → remove this comment block.
// All calling code ({Controller}, tests) is unchanged during the swap.
public Task<{ReturnType}> {MethodAsync}({parameters})
{
    // stub logic
    return Task.FromResult({stubResult});
}
```

### Real implementation (swap — future)

```csharp
// Real implementation — replace stub body with this when {condition confirmed}
public async Task<{ReturnType}> {MethodAsync}({parameters})
{
    // ❓ Confirm: {endpoint URL, param names, response shape}
    var response = await _httpClient.{GetAsync/PostAsync}({url});
    response.EnsureSuccessStatusCode();
    var result = await response.Content.ReadFromJsonAsync<{Type}>();
    return result ?? {empty/default};
}
```

> **Stub swap checklist (for future developer):**
> 1. Confirm {what to confirm with which team}
> 2. Update DTO field names if JSON keys differ (add `[JsonPropertyName]`)
> 3. Replace method body only — signature and calling code unchanged
> 4. Validate integration tests {INT-N} and {INT-M} against non-prod
> 5. PR title: `[ADO-{ID}] {Feature} — swap stub for real {endpoint}`

---

## DTO / Model — {XModel.cs} (if new)

```csharp
namespace {KE.Project.Models};

/// <summary>
/// {Description of this model's purpose}.
/// {If stub-phase model: also used as stub data type so projection
/// logic is identical in stub and real implementations.}
/// ❓ Confirm JSON field names before stub swap.
/// </summary>
public class {XModel}
{
    /// <summary>
    /// {Property description}.
    /// ❓ Confirm field name and type with {team} before swap.
    /// </summary>
    public {Type} {Property} { get; set; } = {default};
}
```

> **Existing DTO extension:**
> If extending an existing search/request DTO, add the property there.
> Default to an empty collection (`= []`) not null — prevents null-reference
> in serialisation and downstream null checks.
> ```csharp
> /// <summary>{description}</summary>
> public List<string> {Property} { get; set; } = [];
> ```

---

## View — {XView.cshtml}

### HTML component

```html
<!-- {Feature description} — ADO-{ID} -->
<div class="mb-3" id="{feature}-group">
    <label class="form-label" for="{input-id}">{Label}</label>
    {input / container element}
    <!-- Hidden inputs for form submission if needed -->
    <div id="{feature}-hidden-inputs"></div>
    <!-- Accessible status message for dynamic content -->
    <div id="{feature}-status-msg" class="small mt-1 d-none"
         aria-live="polite" aria-atomic="true"></div>
</div>
```

**Accessibility requirements:**
- `aria-live="polite"` on any element whose content changes dynamically
- `aria-label` on icon-only buttons (e.g. remove/close buttons)
- Form labels associated with inputs via `for`/`id` pairing
- Keyboard navigation supported (jQuery UI provides this for autocomplete)

### JavaScript

Place in the page-specific script section below existing JS. Wrap in an
IIFE to avoid polluting global scope.

```javascript
// {Feature description} — ADO-{ID}
(function () {
    // DOM references
    const ${element} = $('#{element-id}');

    // State
    // {describe any state variables — e.g. Set for multi-select}

    // Functions
    function {functionName}({params}) {
        // {description}
    }

    // Event bindings
    ${element}.on('{event}', function () {
        // {handler}
    });
}());
```

**XSS safety:**
- Use `.text(value)` not `.html(value)` when rendering user-controlled or
  server-returned strings into the DOM
- Use `.attr('attribute', value)` not string interpolation for attributes
- Use `CSS.escape(value)` when using a value in a jQuery selector string
- Never use `innerHTML`, `.html()` with untrusted data, or `eval()`

**jQuery UI dependency check:**
Confirm jQuery UI is already in the bundle before adding a new component.
Check existing usages in the same view. If absent, add to the existing
bundle script reference — never add a separate `<script>` tag.

### CSS

Add to the relevant `.css` file or inline `<style>` block if scoped to
one view. Prefer existing Bootstrap utility classes over custom CSS.

```css
/* {Feature description} — ADO-{ID} */
.{feature-class} {
    /* {styles} */
}
```

---

## API Changes

### New internal endpoint (if applicable)

| Property | Value |
|---|---|
| Method | GET / POST |
| URL | /{Controller}/{Action} |
| Auth | Required — OIDC cookie session (`[Authorize]`) |
| Anti-forgery | Not required (GET) / Required (POST) |
| Parameters | {param} — {type}, {required/optional}, {constraints} |
| Response (success) | 200 OK · application/json · {type description} |
| Response (guard fired) | 200 OK · application/json · {empty/error} |
| Response (unauthenticated) | 302 redirect to login |

> This endpoint is internal to {Project}. Not part of the {Company} Data
> API and not exposed externally. No API gateway or CORS config needed.

### Change to outbound API call (if applicable)

Describe what field(s) are added to the existing outbound request body.

**Before:**
```json
{ "existingField": "...", "pageNumber": 1 }
```

**After:**
```json
{ "existingField": "...", "pageNumber": 1, "newField": ["value"] }
```

| Property | Type | Required | Notes |
|---|---|---|---|
| {newField} | {type} | No | {description, OR logic, empty = no filter} |

> ❓ Confirm JSON key name with {team} — add `[JsonPropertyName]` if
> the .NET property name would serialise differently.

### DB / persistence changes

{Describe any schema changes, migrations, or new tables.
If none: "No DB changes. {Project} is stateless / reads from downstream APIs only."}

---

## Auth & Security

### Anti-forgery token

| Action | Method | Anti-forgery required? | Rationale |
|---|---|---|---|
| {ActionName} | GET | No | Read-only |
| {ActionName} | POST | Yes — `[ValidateAntiForgeryToken]` | State mutation |

### XSS safety analysis

| Location | Method | Safe? |
|---|---|---|
| {element} rendered with server value | `.text(value)` | ✅ Yes — sets textContent |
| {attribute} set with server value | `.attr('attr', value)` | ✅ Yes — DOM attribute |
| Selector using user value | `CSS.escape(value)` | ✅ Yes — escapes special chars |

**Verdict:** {no XSS risk / risk identified at: {location} — mitigated by: {mitigation}}

### Reviewer checklist (story-specific)

**Auth**
- [ ] `[Authorize]` present or inherited — not bypassed with `[AllowAnonymous]`
- [ ] GET actions have no `[ValidateAntiForgeryToken]` (correct — confirm intentional)
- [ ] POST actions have `[ValidateAntiForgeryToken]`

**XSS**
- [ ] No `.html(serverValue)` or `innerHTML` with server-controlled data
- [ ] `.text()` used for all text rendering
- [ ] `CSS.escape()` used in any jQuery selector that includes a runtime value

**Stub integrity (if applicable)**
- [ ] `// STUB ADO-{ID}` comment present with swap criteria
- [ ] Stub field is `private static readonly` — not public
- [ ] Method signature matches interface exactly — no overload drift

**Regression**
- [ ] Empty/absent new property does not change existing behaviour
- [ ] Existing actions unchanged
- [ ] Anti-forgery on existing POST actions unchanged
