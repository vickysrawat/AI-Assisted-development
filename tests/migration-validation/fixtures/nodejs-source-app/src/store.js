'use strict';

// In-memory data store. Not persistent — resets on every process start.
// Seeded with a couple of expenses so GET endpoints have something to return.
const expenses = new Map();

let nextId = 1;

function seed() {
  expenses.clear();
  nextId = 1;
  create({ employeeId: 'emp-1', amount: 42, category: 'meals', description: 'Team lunch' });
  create({ employeeId: 'emp-2', amount: 1200, category: 'travel', description: 'Flight to NYC' });
}

function create({ employeeId, amount, category, description }) {
  const id = String(nextId++);
  const record = {
    id,
    employeeId,
    amount,
    category,
    description: description || '',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
  expenses.set(id, record);
  return record;
}

function get(id) {
  return expenses.get(id) || null;
}

function all() {
  return Array.from(expenses.values());
}

function update(id, patch) {
  const existing = expenses.get(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  expenses.set(id, merged);
  return merged;
}

seed();

module.exports = { create, get, all, update, seed };
