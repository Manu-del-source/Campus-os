/**
 * Authorization errors.
 *
 * These are thrown deep in server code and translated once, at the route/action
 * boundary, so that no handler forgets to convert them into a safe response.
 * Messages are intentionally free of tenant or record details.
 */

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Raised when a request touches a record that belongs to another tenant.
 * Treated as "not found" at the boundary so tenant existence is not leaked.
 */
export class TenantAccessError extends Error {
  readonly status = 404;
  constructor(message = 'Resource not found.') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export function isAuthorizationError(
  error: unknown,
): error is UnauthenticatedError | ForbiddenError | TenantAccessError {
  return (
    error instanceof UnauthenticatedError ||
    error instanceof ForbiddenError ||
    error instanceof TenantAccessError
  );
}
