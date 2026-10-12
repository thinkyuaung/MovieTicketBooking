/**
 * An error with an HTTP status and a message that is safe to show to users.
 */
export class AppError extends Error {
  readonly status: number;
  readonly details?: unknown;

  /**
   * @param status - HTTP status code to respond with.
   * @param message - User-facing message.
   * @param details - Optional extra data, e.g. the seats that were taken.
   */
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Creates a 400 error for an invalid request.
 *
 * @param message - User-facing message.
 * @param details - Optional extra data.
 * @returns The error.
 */
export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, message, details);
}

/**
 * Creates a 401 error for a missing or invalid login.
 *
 * @param message - User-facing message.
 * @returns The error.
 */
export function unauthorized(message = "Please log in."): AppError {
  return new AppError(401, message);
}

/**
 * Creates a 403 error for a logged-in user without permission.
 *
 * @param message - User-facing message.
 * @returns The error.
 */
export function forbidden(message = "You don't have permission to do this."): AppError {
  return new AppError(403, message);
}

/**
 * Creates a 404 error.
 *
 * @param what - What was not found, e.g. "Movie".
 * @returns The error.
 */
export function notFound(what: string): AppError {
  return new AppError(404, `${what} not found.`);
}

/**
 * Creates a 409 error for a request that clashes with the current state.
 *
 * @param message - User-facing message.
 * @param details - Optional extra data.
 * @returns The error.
 */
export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, message, details);
}
