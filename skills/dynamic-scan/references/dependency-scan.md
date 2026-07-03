# Dependency Vulnerability Scan (SCA)

Always safe — no traffic to the app. Runs alongside the live scan, or alone with `--deps-only`.

| Manifest detected | Command | Source DB |
|---|---|---|
| `*.csproj` / `packages.config` | `dotnet list package --vulnerable --include-transitive` | GitHub Advisory |
| `package.json` / lockfile | `npm audit --json` | npm advisories |
| `yarn.lock` | `yarn audit --json` | npm advisories |
| `requirements.txt` / `Pipfile.lock` / `pyproject.toml` | `pip-audit -f json` | PyPI / OSV |
| `pom.xml` (Maven) | `mvn org.owasp:dependency-check-maven:check` or `mvn versions:display-dependency-updates` | OWASP / OSS Index |
| `build.gradle` (Gradle) | `gradle dependencyCheckAnalyze` (OWASP plugin) | OWASP / OSS Index |
| `Gemfile.lock` | `bundle audit` | RubySec |
| `go.sum` | `govulncheck ./...` | Go vuln DB |

`dotnet list package --vulnerable` is built into the .NET SDK — no extra install, runs on
the dev machine or in a `mcr.microsoft.com/dotnet/sdk` container.

## Output handling
- **Direct vs transitive** — direct: you own the upgrade; transitive: pin or pressure upstream.
- **Severity filter** — `--fail-on` applies here too; default reports all, highlights High+.
- **Fix mode** — show the patched version and whether the upgrade is safe
  (`npm audit fix --dry-run`, `dotnet add package <pkg> --version <fixed>`).
- **Reproducibility** — audit results vary with registry state; record the scan date.
