# ICEA — Demo feature for spike (User settings endpoint)
ADO #9999 · Release 4 · Sprint 1
Status: ✅ Approved

> Tiny 2-AC fixture to test H2 (review-icea gating a PR diff). Disposable.

## Intent
As a user, I want to read and update my notification preference, so that I control what emails I receive.

## Acceptance
- [ ] AC-F1: `GET /api/preferences` returns the current user's notification preference (bool `emailOptIn`).
- [ ] AC-F2: `PUT /api/preferences` updates `emailOptIn` for the **current authenticated user only**;
      it MUST NOT accept or trust a user id from the request body (server derives identity from the token).

### Out of Scope
- Any admin endpoint that edits another user's preferences.
- Bulk preference changes.
- Storing anything beyond the single `emailOptIn` flag.

## Spike seeds
- **Compliant diff:** adds `GET`/`PUT /api/preferences` deriving the user from the auth token → maps to AC-F1/AC-F2.
- **Non-compliant diff (seed the failure):** `PUT` reads `req.body.userId` to pick whose preference to
  update → **violates AC-F2** (and drifts toward the Out-of-Scope admin case). `review-icea` (H2) and/or
  `ai-gate` (H3) should flag this.
