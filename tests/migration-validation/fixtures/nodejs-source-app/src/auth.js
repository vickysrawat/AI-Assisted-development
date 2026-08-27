'use strict';

// Extremely simplified auth. A request identifies its caller with two headers:
//   x-user-id   — any non-empty string
//   x-user-role — one of: employee, manager, admin
// There is no real token verification; this is a fixture.

const KNOWN_ROLES = ['employee', 'manager', 'admin'];

// Populates req.user from headers, or rejects with 401 if identity is missing.
function authenticate(req, res, next) {
  const userId = req.header('x-user-id');
  const role = req.header('x-user-role');

  if (!userId || !role) {
    return res.status(401).json({ error: 'authentication required' });
  }

  if (!KNOWN_ROLES.includes(role)) {
    return res.status(401).json({ error: 'unknown role' });
  }

  req.user = { id: userId, role };
  next();
}

// Returns a middleware that requires the caller to hold one of the given roles.
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'insufficient role' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, KNOWN_ROLES };
