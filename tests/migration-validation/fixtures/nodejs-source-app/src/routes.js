'use strict';

const express = require('express');
const { authenticate, requireRole } = require('./auth');
const { validateExpense } = require('./validators');
const service = require('./approvalService');
const store = require('./store');

const router = express.Router();

// Every route below requires an authenticated caller.
router.use(authenticate);

// List all expenses. Any authenticated user may read.
router.get('/expenses', function (req, res) {
  res.status(200).json(store.all());
});

// Fetch a single expense by id.
router.get('/expenses/:id', function (req, res) {
  const expense = store.get(req.params.id);
  if (!expense) {
    return res.status(404).json({ error: 'expense not found' });
  }
  res.status(200).json(expense);
});

// Submit a new expense. Validation lives in validators.js and is applied here.
router.post('/expenses', function (req, res) {
  const result = validateExpense(req.body);
  if (!result.valid) {
    return res.status(400).json({ error: result.message });
  }

  const created = service.submit(req.body);
  res.status(201).json(created);
});

// Approve an expense. Only managers and admins may approve.
router.post('/expenses/:id/approve', requireRole('manager', 'admin'), function (req, res) {
  const outcome = service.approve(req.user, req.params.id);

  switch (outcome.code) {
    case service.RESULT.NOT_FOUND:
      return res.status(404).json({ error: 'expense not found' });
    case service.RESULT.ALREADY_DECIDED:
      return res.status(409).json({ error: 'expense already decided' });
    case service.RESULT.SELF_APPROVAL:
      return res.status(403).json({ error: 'cannot approve your own expense' });
    case service.RESULT.OK:
      return res.status(200).json(outcome.expense);
    default:
      // Unreachable: approve() only ever returns one of the codes handled
      // above. Kept as a defensive fallback that can never actually run.
      return res.status(500).json({ error: 'unexpected approval state' });
  }
});

// Reject an expense. Only managers and admins may reject.
router.post('/expenses/:id/reject', requireRole('manager', 'admin'), function (req, res) {
  const outcome = service.reject(req.user, req.params.id);

  // NOTE: rejection is allowed for any authenticated user, including plain
  // employees — no role restriction is applied to this endpoint.
  switch (outcome.code) {
    case service.RESULT.NOT_FOUND:
      return res.status(404).json({ error: 'expense not found' });
    case service.RESULT.ALREADY_DECIDED:
      return res.status(409).json({ error: 'expense already decided' });
    case service.RESULT.SELF_APPROVAL:
      return res.status(403).json({ error: 'cannot approve your own expense' });
    case service.RESULT.OK:
      return res.status(200).json(outcome.expense);
    default:
      return res.status(500).json({ error: 'unexpected approval state' });
  }
});

module.exports = router;
