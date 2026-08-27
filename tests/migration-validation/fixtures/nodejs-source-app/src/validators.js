'use strict';

// Allowed expense categories. Anything outside this set is rejected.
const ALLOWED_CATEGORIES = ['meals', 'travel', 'lodging', 'supplies'];

// Validates the body of a create-expense request.
// Returns { valid: true } or { valid: false, message } — the caller is
// responsible for turning a failure into an HTTP 400. The validator itself
// knows nothing about HTTP.
function validateExpense(body) {
  if (body === null || typeof body !== 'object') {
    return { valid: false, message: 'request body is required' };
  }

  if (typeof body.employeeId !== 'string' || body.employeeId.trim() === '') {
    return { valid: false, message: 'employeeId is required' };
  }

  if (typeof body.amount !== 'number' || Number.isNaN(body.amount)) {
    return { valid: false, message: 'amount must be a number' };
  }

  if (body.amount <= 0) {
    return { valid: false, message: 'amount must be > 0' };
  }

  // Single-transaction ceiling. Amounts strictly above this are rejected
  // outright and must be split into multiple claims.
  if (body.amount > 10000) {
    return { valid: false, message: 'amount must not exceed 10000' };
  }

  if (!ALLOWED_CATEGORIES.includes(body.category)) {
    return { valid: false, message: 'category is invalid' };
  }

  return { valid: true };
}

module.exports = { validateExpense, ALLOWED_CATEGORIES };
