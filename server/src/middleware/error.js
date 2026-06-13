import { ApiError } from '../utils/http.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }
  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Related record does not exist or is in use' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Route not found' });
}
