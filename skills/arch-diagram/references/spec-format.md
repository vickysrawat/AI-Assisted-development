# Spec format — what a generated /arch-diagram spec looks like

_Reference for `skills/arch-diagram/SKILL.md` Steps 4–5 and 10 · ADO-8001 · AC-F6, AC-F9, AC-F14 · ADO-82 (Azure icons)_

The full list of keys, zone styles, component types and flow kinds is the docstring at the top
of `$PLUGIN_DIR/scripts/architecture-diagram.py`. This page adds the conventions a **generated**
spec must follow, so a reviewer (and `arch-spec-scan.cjs --sources`) can trace every item.

---

## Conventions for generated specs

1. **One item per line or block.** Write each zone, component and flow as its own list item:
   a block (`- id: …` on its own line) or a one-line mapping (`- {id: …}`). Never put items
   inline in a list (`components: [{…}, {…}]`), because they can't be checked one by one.
2. **Every item says where it came from.** End the item's first line with
   `# source: path[:line]`. Paths are relative to the repository root, and several sources are
   separated by commas. Documents are cited the same way:
   `# source: .claude/architecture/architecture-deployment.md:42`.
3. **No evidence → `⚠ TODO`, never a guess.** Give the item `todo: true` and a detail line
   that says what is unknown: `details: ["⚠ TODO: backup schedule not found"]`. The renderer
   draws it amber-dashed with "⚠ unverified" (grey for flows), and the legend explains it.
   An item with a `⚠ TODO` detail must also have `todo: true`.
4. **`# manual`** on an item's first line marks it as owned by the developer. Refresh mode keeps
   it exactly as written (see § `# manual` below). Generated items never carry `# manual`.
5. **`type: stack`** wrappers are layout only and need no source.
6. **Names, not values.** Secret names, key names and vault names may appear. Secret values,
   passwords, tokens and connection strings never do. Hostnames and server names appear exactly as
   found. The diagram shows the real names; they are listed in Step 7 for information.

`node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --sources --root=<repo> <spec file>` (or `--stdin`)
checks rules 1–3 and 5, and that every cited file and line exists.

---

## `# manual` — items the developer owns (refresh mode, AC-F10)

Put `# manual` at the end of an item's **first line** to keep it out of refresh. Use it for things
the repository cannot show, such as a firewall the network team runs, a DR site described only
in a Word document, or a label you reworded.

```yaml
  - id: fw   # manual
    name: "Company firewall"
    type: firewall
    details: ["Owned by the network team"]
```

What `/arch-diagram --refresh` does with it:
- the whole item block is kept byte for byte, including its children and comments
- it is never re-derived from evidence, even if a new item gets the same id (the manual one wins)
- it goes back into the same zone, at the same place and the same nesting (indentation is part of
  the block)
- `arch-spec-scan.cjs --manual-kept=<saved spec>` checks, before the refreshed draft is shown,
  that each manual block is still a list item with the same key, the same text byte for byte and
  the same zone. Its position among its neighbours is not checked
- the refresh summary lists it under **Kept (manual)**
- it is still secret-scanned, and a match blocks the save until you fix that item yourself

`# manual` replaces `# source:` for that item (an item can't need both). A `# manual` zone keeps
all its components too, and they need no `# source:` of their own. Put `# manual` only as the
last thing on the item's first line; `#manual` inside a label does not count. To give an item back to the generator, delete the `# manual` comment.

---

## Azure icons (ADO-82)

Boxes of an Azure service type show the official Azure Architecture Icon on their left, with
no change to the spec. A box that holds other boxes shows its type in its heading instead.

| Gets an icon by default | Types |
|---|---|
| Yes | `aks` `app-service` `function-app` `front-door` `app-gateway` `key-vault` `storage` `azure-sql` `app-insights` `container-apps` `users` `event-hubs` `service-bus` `log-analytics` `private-endpoint` `network-interface` `vnet` `expressroute` `entra-app` |
| No (not one Azure service) | `vm` `firewall` `load-balancer` `registry` `pipeline` `dns` `monitoring` `sql-server` `kubernetes` `identity` `database` `file-share` and every non-Azure type |

- `icon: <name>` gives a box any bundled icon, for example `icon: firewalls` on an Azure Firewall
  or `icon: virtual-machine` on an Azure VM. Use it only when the box really is that Azure
  service. The names are in `$PLUGIN_DIR/assets/icons/azure/manifest.json`.
- `icon: ""` hides the icon, including the built-in database and user shapes.
- An unknown name prints a warning and the box keeps its usual icon. The render does not fail.
- The icons are Microsoft's, under Microsoft's terms, not the plugin's MIT licence. See
  `$PLUGIN_DIR/assets/icons/azure/NOTICE.md`.

---

## Example: generated for a Docker Compose repository

The spec the skill drafts for the fixture `tests/fixtures/arch-diagram/docker-compose-app/`.
Every line number is real; the plugin's tests check them.

```yaml
title: "contoso-orders — Architecture & Recovery"   # source: package.json:2
subtitle: "Docker Compose on one host"
zones:
  - id: uz   # source: nginx/default.conf:4
    name: ""
    style: plain
    row: 1
    span: 0.7
    components:
      - {id: users, name: Users, type: users, tag: "", details: ["shop.contoso.example.com"]}   # source: nginx/default.conf:4
  - id: host   # source: docker-compose.yml:1
    name: "Docker host"
    row: 1
    span: 3
    columns: 3
    components:
      - {id: nginx, name: nginx, type: reverse-proxy, details: ["nginx:1.27", "Ports 80 / 443"]}   # source: docker-compose.yml:3
      - id: services   # source: docker-compose.yml:13, docker-compose.yml:28
        name: "Application services"
        type: docker-host
        tag: "Compose project"
        columns: 1
        children:
          - {id: api, name: contoso-api, type: compose-service, details: ["Port 8000"]}   # source: docker-compose.yml:13
          - {id: worker, name: worker, type: compose-service}   # source: docker-compose.yml:28
      - type: stack
        children:
          - {id: db, name: contoso-db, type: database, details: ["postgres:16", "Volume pgdata"]}   # source: docker-compose.yml:39
          - {id: cache, name: contoso-cache, type: queue, tag: "Cache / queue", details: ["redis:7"]}   # source: docker-compose.yml:46
  - id: backups
    name: "Backups"
    row: 2
    style: shared
    todo: true
    details: ["⚠ TODO: no backup job found in code or documents"]
    components:
      - id: dump
        name: Database backup
        type: backup
        todo: true
        details: ["⚠ TODO: schedule and retention unknown"]
flows:
  - {from: users, to: nginx, label: "HTTPS 443"}   # source: docker-compose.yml:7
  - {from: nginx, to: api, label: "HTTP 8000"}   # source: nginx/default.conf:7
  - {from: api, to: db, label: "DB_HOST"}   # source: docker-compose.yml:18
  - {from: api, to: cache, label: "REDIS_URL"}   # source: docker-compose.yml:19
  - {from: worker, to: db, label: "DB_HOST"}   # source: docker-compose.yml:33
  - {from: worker, to: cache, label: "REDIS_URL"}   # source: docker-compose.yml:34
  - from: db
    to: dump
    kind: recovery
    todo: true
    label: "⚠ TODO: restore procedure not documented"
```

Note what the skill did **not** add: no failover site, firewall or monitoring. The fixture has
no evidence for them, and there are no architecture documents to cite. The Step 7 summary says
"no architecture docs — diagram drawn from code only". The `SESSION_SIGNING_SECRET` value in
`docker-compose.yml` is not in the spec. At most its key name could appear.

---

## Zone templates by hosting model

Start from the template whose roles have evidence, then drop zones with nothing in them.

| Hosting | Zones, top row → bottom row |
|---|---|
| Kubernetes / AKS | users · primary site (cluster → ingress, pods, secrets, volumes; database + backups as a `stack`) · failover site if documented · cloud identity · shared services · CI/CD |
| Docker Compose | users · Docker host (reverse proxy, services in a `docker-host`, data in a `stack`) · backups · CI/CD |
| Node.js / Linux server | users · data centre (`linux-server` → `reverse-proxy` + `process-manager` → `node-server`s; database) · recovery · CI/CD |
| Azure PaaS | users · cloud global (Front Door, identity) · primary region (App Service plan → apps; SQL, storage, Key Vault, App Insights) · secondary region if present · CI/CD |
| AWS | users · region (load balancer, `aws-ecs` → containers, `aws-lambda`; `aws-rds`, `s3`, queues) · CI/CD |
| On-prem IIS | users · primary data centre (load balancer, `iis-server` → sites + pools, SQL Server) · DR data centre if documented · shared services (directory, mail, logging) · CI/CD |
| Not recognised | users if known · one zone with a `server` box, `todo: true` |

Use `style: failover` with `standby: true` components for a documented DR site, and
`kind: recovery` flows for the documented recovery steps. Use `kind: data` for replication and
backups, and `kind: deploy` for pipeline flows.

---

## Layout levers (Step 10, one revision)

When `--check` reports problems, propose **one** of these as a diff:

| Problem | Lever |
|---|---|
| `overlap …` or a crowded zone, `no clear path for flow N` | `span:` on the crowded zone (for example 2 → 3), so its row gives it more width |
| Arrows crossing many boxes in one zone | `columns:` on that zone or container (fewer columns = taller, more gaps to route through) |
| A database and its backup side by side, taking width | wrap both in `- type: stack` |
| One row too full | `row:` to move a zone onto its own row |
| `crosses the text of …` | `columns:` or `span:` on that container, so its heading clears the arrow's path |
