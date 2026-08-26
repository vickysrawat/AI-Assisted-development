SOURCE BEHAVIORAL INVENTORY — ADO-0001
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: fixtures/_selftest/source @ 2026-08-25T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW

# Self-test GOOD fixture — every F-row and GAP carries a resolvable PROV token.
# Expected verifier result: PASS (0 hard failures; 1 advisory for the timestamp-only snapshot).

### 5. Feature Catalog

| ID | Feature | Layers | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|F-01| Order quantity validation | API·svc | reject non-positive quantity with 400 "Quantity must be positive" | STATIC | PROV:src/orders/OrderService.cs#L20-L28 | yes | UNKNOWN (ask) | Pending |
|F-02| Create order | API·svc·DB | on valid input persist order and return 201 with the new id | STATIC | PROV:src/orders/OrderService.cs#L42 | yes | UNKNOWN (ask) | Pending |
|F-03| Manager approval limit | API·svc | over-limit approval by a non-permitted caller returns 403 "Approval limit exceeded" — no state change | INFERRED | PROV:src/services/ApprovalService.cs#L88 | yes | UNKNOWN (ask) | Pending |

### 11. Gaps Report

GAP-001 | PROV:src/services/ApprovalService.cs#L60 | type: static-unresolvable (config/feature-flag) | the effective approval threshold is read from runtime config; static reading cannot resolve the number | resolve by: run the source (golden-master) | disposition: Pending
