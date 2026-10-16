# Spec: Delivery & Operations Concerns Catalog

_A shared reference invoked by **Rewrite** (Step 2.2) and **Replatform** (R1 NFR intake)
after the target stack/hosting option is selected and before design documents are authored.
Defines the eight delivery concerns, their options ordered simple→complex, and the
pre-flight gate that resolves org-mandated choices before presenting options._

---

## Purpose

Code quality and architecture get the most attention in a migration. The delivery and
operations layer — how the app runs locally, where it deploys, how secrets are managed —
is often under-specified until a developer hits a problem in production. This catalog
makes those choices explicit and documented before any code is written.

---

## Pre-flight gate

Before presenting options, the skill asks:

> "Before we discuss options, mark any concerns your org has already decided.
> Reply with the numbers of mandated items (e.g. "2, 5") — or "none" to accept
> all defaults. For mandated items, include your org's choice
> (e.g. "2=ECS, 5=GitHub Actions, 6=Terraform")."

**Fast-path:** Developer replies `none` → all defaults accepted, skill proceeds
to design documents with defaults recorded in the ledger.

**Mandated items:** Skill asks for the org's tool for each mandated concern,
records it in the ledger under `delivery_concerns.mandated`, and skips the
options presentation for those concerns.

**Un-mandated items:** Skill presents options for each remaining concern,
developer selects or accepts the default, result recorded in the ledger under
`delivery_concerns.chosen`.

---

## Concerns catalog

### 1 — Local dev

```
A) Docker Compose      [simple ← default]   Your team runs different OSes (Windows /
                                             Mac / Linux mix) and each dev uses
                                             their own editor setup
B) Dev Containers      [complex]             "Works on my machine" bugs are common,
                                             or onboarding new devs takes more than
                                             a day to get running
```

Sources: docs.docker.com (`docker init` generates Dockerfile + Compose for many
stacks), containers.dev

---

### 2 — Deployment target

```
A) Managed containers  [simple ← default]   No dedicated ops team — you want the
   (Container Apps /                         cloud to handle scaling and patching
    Cloud Run / ECS)
B) Kubernetes          [complex]             Your org has a platform or SRE team
                                             that already runs Kubernetes, or you
                                             need sidecars / custom networking
```

Sources: Azure Architecture Center, AWS Architecture Center, kubernetes.io

> Note: K8s is opt-in, never the default. Managed containers (Container Apps,
> Cloud Run, ECS) is the recommended starting point for any team without a
> dedicated platform team.

---

### 3 — K8s packaging  _(only presented if concern 2 = Kubernetes)_

```
A) Kustomize           [simple ← default]   One app, a few environments, only
                                             small differences between them
B) Helm                [complex]             Packaging the app for others to install,
                                             or many environments with significantly
                                             different configurations
```

Sources: kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization,
helm.sh/docs

---

### 4 — DB schema migrations

```
A) Stack-native        [simple ← default]   One team owns the DB and migrations
   (Prisma / Alembic /                       live in the same repo as the code
    EF Core)
B) Flyway              [moderate]            A DBA manages migrations separately
                                             from the dev team, in plain SQL files
C) Liquibase           [complex]             Multiple applications share the same
                                             database, or every change needs a
                                             rollback script for compliance
```

Sources: flywaydb.org, liquibase.com

---

### 5 — CI/CD

```
A) Existing platform   [simple ← always]   Use what your team already operates
   (Azure DevOps /
    GitHub Actions /
    GitLab)
```

No option B. The skill always uses the team's existing CI/CD platform.
Introducing a new CI/CD platform during a migration adds unrelated risk.

Sources: Platform docs (Azure DevOps, GitHub Actions, GitLab CI)

---

### 6 — Infrastructure as code

```
A) Bicep /             [simple ← default]   All resources live in one cloud
   CloudFormation                            (Azure or AWS only)
B) Terraform /         [complex]             Resources span multiple clouds, or
   OpenTofu                                  your platform team mandates a
                                             vendor-neutral tool
```

Sources: learn.microsoft.com/azure/azure-resource-manager/bicep,
opentofu.org/docs

---

### 7 — Config and secrets

```
A) Env vars            [simple ← default]   Fewer than five secrets, no compliance
   (12-factor)                               requirement
B) Managed vault       [complex]             Compliance requirement (PCI, HIPAA,
   (Key Vault /                              SOC2), secrets need rotation, or the
    Secrets Manager)                         same secret is shared across multiple apps
```

Sources: 12factor.net (§III Config), cloud vault docs

---

### 8 — Observability

```
A) Platform-native     [simple ← default]   All services run on one platform and
   logging                                   you use its built-in monitoring
B) OpenTelemetry       [complex]             Services span multiple platforms, or
                                             you've had to re-instrument after
                                             switching monitoring vendors before
```

Sources: opentelemetry.io/docs

---

## Normative references

These three sources frame the overall delivery posture — referenced in skill
output when recommending options, never surfaced as a full list:

- **12factor.net** — baseline any rewritten app should meet: config in the
  environment, logs as streams, dev/prod parity
- **Azure / AWS Well-Architected Frameworks** — checklist questions on
  reliability, security, cost, and operations
- **dora.dev** — research-backed guidance on which delivery practices
  improve outcomes

> The CNCF Landscape (landscape.cncf.io) is a useful internal reference
> but is never surfaced to developers — it lists over a thousand tools
> and is the opposite of a short menu.

---

## Ledger output format

The skill writes resolved delivery concerns to the migration ledger under:

```json
"delivery_concerns": {
  "mandated": {
    "2": "ECS",
    "5": "GitHub Actions"
  },
  "chosen": {
    "1": "Docker Compose",
    "3": null,
    "4": "Stack-native (EF Core)",
    "6": "Bicep",
    "7": "Env vars",
    "8": "Platform-native logging"
  }
}
```

`mandated` = org-decided before skill ran.
`chosen` = selected during the pre-flight gate.
`null` = concern not applicable (e.g. K8s packaging when managed containers chosen).
