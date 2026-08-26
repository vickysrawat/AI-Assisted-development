'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { validateExpense } = require('../src/validators');

test('accepts a well-formed expense', function () {
  const result = validateExpense({ employeeId: 'emp-1', amount: 42, category: 'meals' });
  assert.strictEqual(result.valid, true);
});

test('rejects a zero amount with the exact message', function () {
  const result = validateExpense({ employeeId: 'emp-1', amount: 0, category: 'meals' });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, 'amount must be > 0');
});

test('rejects a negative amount with the exact message', function () {
  const result = validateExpense({ employeeId: 'emp-1', amount: -5, category: 'meals' });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, 'amount must be > 0');
});

test('rejects an amount above the 10000 ceiling', function () {
  const result = validateExpense({ employeeId: 'emp-1', amount: 10001, category: 'travel' });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, 'amount must not exceed 10000');
});

test('rejects an unknown category', function () {
  const result = validateExpense({ employeeId: 'emp-1', amount: 10, category: 'bribes' });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, 'category is invalid');
});
