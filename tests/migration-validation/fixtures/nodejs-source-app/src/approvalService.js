'use strict';

const store = require('./store');
const { config } = require('./config');

// Result codes returned to the route handler. The handler maps these to HTTP.
const RESULT = {
  OK: 'OK',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_DECIDED: 'ALREADY_DECIDED',
  SELF_APPROVAL: 'SELF_APPROVAL',
};

// Helper, level 2 of the call chain. This is where the self-approval rule
// actually lives — it is NOT visible in the route handler or in the top-level
// service function; you have to follow approve() down into here to find it.
function canDecide(actor, expense) {
  // An approver may never act on their own expense claim, regardless of role.
  if (actor.id === expense.employeeId) {
    return { allowed: false, reason: RESULT.SELF_APPROVAL };
  }
  return { allowed: true };
}

// Helper: decides whether a brand-new expense should be auto-approved.
// The outcome depends on config.autoApproveEnabled, which is read from the
// environment at startup — so it is not statically determinable.
function initialStatusFor(amount) {
  if (config.autoApproveEnabled && amount <= config.autoApproveCeiling) {
    return 'approved';
  }
  return 'pending';
}

// Level 1: top-level approve. Called directly by the route handler.
function approve(actor, expenseId) {
  const expense = store.get(expenseId);
  if (!expense) {
    return { code: RESULT.NOT_FOUND };
  }

  if (expense.status !== 'pending') {
    return { code: RESULT.ALREADY_DECIDED, expense };
  }

  const decision = canDecide(actor, expense);
  if (!decision.allowed) {
    return { code: decision.reason, expense };
  }

  const updated = store.update(expenseId, {
    status: 'approved',
    decidedBy: actor.id,
  });
  return { code: RESULT.OK, expense: updated };
}

function reject(actor, expenseId) {
  const expense = store.get(expenseId);
  if (!expense) {
    return { code: RESULT.NOT_FOUND };
  }

  if (expense.status !== 'pending') {
    return { code: RESULT.ALREADY_DECIDED, expense };
  }

  const decision = canDecide(actor, expense);
  if (!decision.allowed) {
    return { code: decision.reason, expense };
  }

  const updated = store.update(expenseId, {
    status: 'rejected',
    decidedBy: actor.id,
  });
  return { code: RESULT.OK, expense: updated };
}

// Creates an expense, applying the (config-dependent) initial status.
function submit({ employeeId, amount, category, description }) {
  const status = initialStatusFor(amount);
  const record = store.create({ employeeId, amount, category, description });
  if (status !== 'pending') {
    return store.update(record.id, { status });
  }
  return record;
}

module.exports = { approve, reject, submit, RESULT, canDecide, initialStatusFor };
