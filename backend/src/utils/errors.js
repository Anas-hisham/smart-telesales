/** Every error leaves the API as { error: { code, message, details? } } */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const Errors = {
  unauthenticated: (message = 'Please sign in') => new ApiError(401, 'UNAUTHENTICATED', message),
  tokenExpired: () => new ApiError(401, 'TOKEN_EXPIRED', 'The session has expired'),
  invalidCredentials: () => new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong username or password'),
  forbidden: (message = 'You are not allowed to do this') => new ApiError(403, 'FORBIDDEN', message),
  notOwner: (message = 'This does not belong to you') => new ApiError(403, 'NOT_OWNER', message),
  notFound: (what = 'Item') => new ApiError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (code, message, details) => new ApiError(409, code, message, details),
  validation: (details = [], message = 'Check the fields') => new ApiError(422, 'VALIDATION_FAILED', message, details),
  tooMany: () => new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Try again in a minute'),
};

module.exports = { ApiError, Errors };
