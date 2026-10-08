# IaC Scan Rule Catalog
Last updated: 2026-10-07

## Coverage Map

| Source | Total checks | Automated here | Excluded (reason) |
|---|---|---|---|
| CIS Docker Benchmark v1.6 | 84 | 5 | 79 excluded — require a running container, built image, or live cluster; not automatable via static file scan (out of scope per ICEA ADO-9016) |
| CIS Kubernetes Benchmark v1.8 | 100+ | 9 | 91+ excluded — require live cluster, admission controller, or runtime audit; not automatable via static YAML scan |
| Docker Compose Security Best Practices (Docker docs) | informal | 5 | N/A — all practical static-analysis checks included |

---

## Dockerfile Rules

Source: CIS Docker Benchmark v1.6
Last-validated: 2026-10-07
Stale-after: 90

### DOCKER-001 — No USER instruction (runs as root)

**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** Dockerfile has no `USER` instruction before the final `CMD` or `ENTRYPOINT`
**Fix:** Add `USER appuser` (or the project-specific non-root user) before the final CMD/ENTRYPOINT

### DOCKER-002 — No pipefail on RUN with pipes

**Severity:** Medium
**ID:** SEC-CONTAINER
**Pattern:** `RUN` instruction contains a pipe (`|`) without `set -o pipefail` or `pipefail` shell option
**Fix:** Prefix the RUN instruction with `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` or prepend `set -o pipefail &&`

### DOCKER-003 — Latest tag used

**Severity:** Medium
**ID:** SEC-CONTAINER
**Pattern:** `FROM image:latest` or `FROM image` with no tag
**Fix:** Pin to a specific, immutable version tag (e.g. `node:20.11-alpine3.19`)

### DOCKER-004 — Debug port exposed

**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `EXPOSE 5858` (Node.js debug), `EXPOSE 9229` (V8 inspector), `EXPOSE 5005` (Java JDWP), or `EXPOSE 5678` (Python debugpy)
**Fix:** Remove the debug `EXPOSE` instruction; debug ports must not be published in production images

### DOCKER-005 — COPY without --chown

**Severity:** Low
**ID:** SEC-CONTAINER
**Pattern:** `COPY` instruction copies application files without the `--chown` flag
**Fix:** Use `COPY --chown=appuser:appgroup . .` so copied files are owned by the non-root user

---

## docker-compose Rules

Source: Docker Compose Security Best Practices (https://docs.docker.com/compose/)
Last-validated: 2026-10-07
Stale-after: 90

### COMPOSE-001 — privileged: true

**Severity:** Critical
**ID:** SEC-CONTAINER
**Pattern:** `privileged: true` present in any service definition
**Fix:** Remove `privileged: true`. If specific capabilities are needed, add them explicitly via `cap_add` with a justification comment.

### COMPOSE-002 — cap_add without justification comment

**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `cap_add:` block present with any capability and no inline `#` comment on the same or following line
**Fix:** Add a comment explaining why the capability is needed, or remove it if not required

### COMPOSE-003 — read_only not set

**Severity:** Low
**ID:** SEC-CONTAINER
**Pattern:** Service definition does not include `read_only: true`
**Fix:** Add `read_only: true` to the service; explicitly mount writable `tmpfs` or named volumes for paths that require writes

### COMPOSE-004 — Plaintext env-var secrets

**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `environment:` block contains a key whose name includes `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, or `PASS` with a literal inline value (not a `${VAR}` reference)
**Fix:** Move the value to a `.env` file (gitignored) or Docker secrets; reference via `${VAR_NAME}` interpolation

### COMPOSE-005 — network_mode: host

**Severity:** High
**ID:** SEC-CONTAINER
**Pattern:** `network_mode: "host"` or `network_mode: host` in any service
**Fix:** Remove `network_mode: host`; define an explicit named network with an isolated driver (bridge or overlay)

---

## Kubernetes YAML Rules

Source: CIS Kubernetes Benchmark v1.8
Last-validated: 2026-10-07
Stale-after: 90

### K8S-001 — Plaintext env-var secrets

**Severity:** Critical
**ID:** SEC-IAC
**Pattern:** `env:` block contains a key whose name includes `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, or `PASS` with `value:` (not `valueFrom:`)
**Fix:** Replace `value:` with `valueFrom.secretKeyRef` referencing a Kubernetes Secret object

### K8S-002 — securityContext.privileged: true

**Severity:** Critical
**ID:** SEC-IAC
**Pattern:** Container spec contains `securityContext:` with `privileged: true`
**Fix:** Remove `privileged: true` from the container's securityContext

### K8S-003 — runAsNonRoot not set

**Severity:** High
**ID:** SEC-IAC
**Pattern:** Container `securityContext` is present but does not include `runAsNonRoot: true`
**Fix:** Add `runAsNonRoot: true` to the container's securityContext

### K8S-004 — hostPath volume

**Severity:** High
**ID:** SEC-IAC
**Pattern:** `volumes:` section contains a `hostPath:` entry
**Fix:** Replace `hostPath` with a `PersistentVolumeClaim`. If unavoidable (e.g. socket mounting), add an inline comment with justification.

### K8S-005 — hostNetwork: true

**Severity:** High
**ID:** SEC-IAC
**Pattern:** Pod spec contains `hostNetwork: true`
**Fix:** Remove `hostNetwork: true`; use a ClusterIP Service for internal pod-to-pod communication

### K8S-006 — cap_add capabilities

**Severity:** High
**ID:** SEC-IAC
**Pattern:** Container `securityContext.capabilities.add` contains any capability
**Fix:** Add `drop: ["ALL"]` and list only the specific capabilities required, with an inline justification comment per capability

### K8S-007 — resources.limits missing

**Severity:** Medium
**ID:** SEC-IAC
**Pattern:** Container spec has no `resources.limits` block (or is missing `limits.cpu` or `limits.memory`)
**Fix:** Add `resources.limits.cpu` and `resources.limits.memory` appropriate to the workload

### K8S-008 — namespace: default

**Severity:** Low
**ID:** SEC-IAC
**Pattern:** Manifest specifies `namespace: default` or omits the `namespace` field entirely
**Fix:** Deploy to an explicit named namespace appropriate to the environment (e.g. `app-production`, `app-staging`)

### K8S-009 — readOnlyRootFilesystem not set

**Severity:** Medium
**ID:** SEC-IAC
**Pattern:** Container `securityContext` is present but does not include `readOnlyRootFilesystem: true`
**Fix:** Add `readOnlyRootFilesystem: true`; mount writable `emptyDir` or `PersistentVolumeClaim` volumes for paths that require writes

---

## Governance

To update this catalog (every 90 days or when `setup-status` flags amber/red):
1. Run `REFRESH RULES iac-scan.md` — the three-way diff flow shows what changed in the canonical plugin version vs. local edits.
2. Update `Last-validated:` date in each affected rule section header.
3. Update the coverage map table if new rules were added or benchmarks bumped.
