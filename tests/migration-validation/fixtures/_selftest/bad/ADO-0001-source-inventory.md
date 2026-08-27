SOURCE BEHAVIORAL INVENTORY — ADO-0001
Behavioral discovery from source — NOT a stakeholder-validated requirements spec.
Source baseline: fixtures/_selftest/source @ 2026-08-25T00:00:00Z
Posture (Stage 0.5): rewrite-from-spec   Depth: Full
Status: ⏳ AWAITING REVIEW

# Self-test BAD fixture — planted defects the verifier MUST catch:
#   F-01 → out-of-range line (#L999)         → LINE OUT OF RANGE (hard)
#   F-02 → missing file (NoSuchService.cs)    → MISSING FILE (hard)
#   F-03 → no PROV token at all               → ITEM WITHOUT PROV (advisory)
#   plus a dangling spine ref in the companion feasibility doc → DANGLING SPINE REF (hard)

### 5. Feature Catalog

| ID | Feature | Layers | Behaviour / rules | Confidence | Provenance | GM-verifiable? | Priority | Review status |
|F-01| Order quantity validation | API·svc | reject non-positive quantity with 400 | STATIC | PROV:src/services/ApprovalService.cs#L999 | yes | UNKNOWN (ask) | Pending |
|F-02| Phantom feature | API | claims a behaviour in a file that does not exist | INFERRED | PROV:src/services/NoSuchService.cs#L10 | yes | UNKNOWN (ask) | Pending |
|F-03| Unsourced feature | svc | a behaviour asserted with no provenance at all | INFERRED | (none) | no | UNKNOWN (ask) | Pending |
