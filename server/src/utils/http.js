// Small HTTP helpers shared across routes.

// Wrap async route handlers so thrown errors reach the error middleware.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// A typed error with an HTTP status code.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message) {
  return new ApiError(400, message);
}

export function notFound(message = 'Not found') {
  return new ApiError(404, message);
}

export function unauthorized(message = 'Unauthorized') {
  return new ApiError(401, message);
}

export function forbidden(message = 'Forbidden') {
  return new ApiError(403, message);
}
