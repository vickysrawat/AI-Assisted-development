# Spec: MIGRATION-REPORT.md

_Loaded by migration SKILL.md at Stage 6.6 (final report step, after the Step 6.5 as-built reconciliation)._
_Defines the format for the migration completion report._

---

## Document: MIGRATION-REPORT.md

**Filename:** `ADO-{ADO_ID}-migration-report.md`
**Purpose:** The authoritative record of what was migrated, what changed, and what residual risks remain.
Written after all clusters are merged, all tests pass, and E2E verification is complete.

### Required Sections

**## 1. Migration Summary**

| Field | Value |
|---|---|
| ADO ID | ADO-{ADO_ID} |
| Source | {SOURCE_PATH} — {source stack} |
| Target | . (current directory) — {target stack} |
| Started | {date} |
| Completed | {date} |
| Clusters migrated | {N} |
| Architecture pattern | {simplified / four-layer} |
| Auth strategy | {from SECURITY-ARCHITECTURE.md} |

**## 2. Clusters Migrated**

| Cluster | Source files | Generated files | Branch | Status |
|---|---|---|---|---|
| SharedKernel | {N} | {N} | feature/migration-cluster-shared-kernel-{sha} | ✅ Merged |
| {ClusterName} | {N} | {N} | feature/migration-cluster-{name}-{sha} | ✅ Merged |

**## 3. What Was Replaced**

For each major source component, what replaced it in the target:

| Source component | Source pattern | Target replacement | Notes |
|---|---|---|---|
| {e.g. Spring Security} | @WebSecurityConfiguration | AddMicrosoftIdentityWebApiAuthentication | Entra ID |
| {e.g. JPA Repository} | JpaRepository<Order, Long> | Dapper OrderRepository | Explicit SQL |
| {e.g. application.yml} | Spring profiles | appsettings.{Env}.json + IOptions<T> | |

**## 4. Behavioral Differences**

Items that behave differently post-migration (not bugs — known, documented differences):

| Component | Source behaviour | Target behaviour | Mitigation |
|---|---|---|---|
| {e.g. Lazy loading} | Auto-loaded navigation properties | Explicit .Include() required | Added .Include() to all repo methods |
| {e.g. Case sensitivity} | Jackson case-insensitive | S.T.J case-sensitive | PropertyNameCaseInsensitive = true |

**## 5. E2E Test Results**

| Test file | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| health.spec.ts | {N} | {N} | {N} | |
| auth.spec.ts | {N} | {N} | {N} | |
| api-contract.spec.ts | {N} | {N} | {N} | |
| navigation.spec.ts | {N} | {N} | {N} | Two-track only |
| forms.spec.ts | {N} | {N} | {N} | Two-track only |

Playwright report: `playwright-report/index.html`

**## 6. Coverage Report**

| Layer | Coverage | Target | Status |
|---|---|---|---|
| Domain | {%} | 95%+ | ✅ / ❌ |
| Application | {%} | 90%+ | ✅ / ❌ |
| Infrastructure | {%} | 70%+ | ✅ / ❌ |

**## 7. Architecture Fitness**

| Rule | Result | Notes |
|---|---|---|
| Domain has no Infrastructure dependency | {PASS / FAIL / DEFERRED} | |
| Application has no Infrastructure dependency | {PASS / FAIL / DEFERRED} | |
| No circular dependencies | {PASS / FAIL / DEFERRED} | |

**## 8. As-Built Reconciliation**

Design-intent (Stage 1 docs) vs. the code that was actually generated (Step 6.5 audit). Full detail in
`ADO-{ADO_ID}-asbuilt-reconciliation.md`.

| Field | Value |
|---|---|
| Audit mode | {MECHANICAL (.NET/Java/Angular) · PARTIAL — {areas} NOT mechanically verified} |
| Divergences | {N} — {N HIGH} · {N MEDIUM} · {N INFORMATIONAL} |
| Endpoints (design vs as-built) | {57 vs 49} |
| Roles (documented vs enforced) | {list phantom/missing} |
| As-built source of truth | `.claude/architecture/*` (regenerated from generated code) |
| Report | `ADO-{ADO_ID}-asbuilt-reconciliation.md` |

All HIGH/BLOCKER divergences must be `explained` or `accepted` before MIGRATION COMPLETE.

**## 9. Integration Verification**

External-dependency classifications, ground-truth-verified at Stage 0.6
(`integration-verification-spec.md`) and cross-checked against generated clients at Step 6.5.

| Integration | Kind (verified) | Evidence | Verification status | As-built match? |
|---|---|---|---|---|
| {e.g. WallBuilder} | WCF basicHttpBinding/Transport/NTLM | PROV:Web.config#L120 | VERIFIED | yes |
| {e.g. RiskMgmtDataMart} | DB (in-process EF6) | PROV:Web.config#L88 | VERIFIED | yes |

Any `UNVERIFIED`/`DEFERRED(task)` row or fail-loud stub is listed as an open blocker here.

**## 10. Residual Risks**

Known risks that exist in the migrated application and should be monitored:

| Risk | Likelihood | Mitigation | Owner |
|---|---|---|---|
| {e.g. EF Core lazy loading not enabled} | Low | Explicit .Include() used throughout | Dev team |

**## 11. Deferred Items**

Work explicitly deferred during migration — must be tracked and completed:

| Item | Reason deferred | ADO tracking | Priority |
|---|---|---|---|
| {e.g. Fitness tests} | Developer chose "Defer" at Stage 0 | ADO-{N} | Medium |

**## 12. Manual Review Items**

Items flagged by cluster agents requiring human review:

| File | Line | Reason | Cluster |
|---|---|---|---|
| {file path} | {line} | {reason from agent's manual_review field} | {ClusterName} |

**## 13. Post-Migration Checklist**

- [x] `architect` + `/graph-sync` run at Step 6.5 — `.claude/architecture/*` + graph built from generated code (as-built SoT)
- [ ] `ADO-{ADO_ID}-asbuilt-reconciliation.md` reviewed — all HIGH divergences resolved/accepted
- [ ] `appsettings.Development.json` populated with real values
- [ ] Visual verification checklist completed
- [ ] Source project at {SOURCE_PATH} removed from additionalDirectories
- [ ] PR raised and reviewed
- [ ] Deployed to staging and smoke-tested
