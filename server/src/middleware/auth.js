import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../utils/http.js';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized('Missing authentication token'));
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
}

// Restrict a route to one or more roles.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('You do not have permission for this action'));
    }
    return next();
  };
}
