# Mapping a ZAP Finding Back to Source

ZAP reports at the HTTP layer (URL + parameter + payload). To propose a real fix, resolve
that to the source file. Reading the file is Category B consent — gate it first.

## URL → handler
- **MVC**: `/Controller/Action` → `Controllers/{Controller}Controller.cs`, method `{Action}`.
  Area routes → `Areas/{Area}/Controllers/...`.
- **Web API**: match `[Route]`/`[Http*]` attributes to the controller + action.
- **Razor Pages**: `/Page` → `Pages/{Page}.cshtml.cs` handler `OnGet/OnPost`.
- **Angular**: route → component; API finding → the Angular service calling that endpoint
  AND the server endpoint behind it (fix server-side).

## Parameter → code
The vulnerable `param` names the model property / action argument. Locate where it is read
and whether it is validated/encoded/parameterised before use.

## Fix proposal pattern
State: the file:line, what is missing (parameterised query, output encoding, authz check,
antiforgery), and the concrete change. Example: SQLi on `id` → show the string-concat line
and the parameterised replacement.

## Dependency findings
No source mapping needed — name the package, direct vs transitive, the fixed version, and
whether `npm audit fix` / `dotnet add package <fixed>` is safe.
