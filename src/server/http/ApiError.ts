/**
 * Typed application error.
 *
 * Every failure the API can produce deliberately maps to one of these codes so
 * that responses are predictable (`{ error: { code, message, details? } }`) and
 * the client never has to guess. This is the alternative to throwing raw
 * `Error`s, which leak implementation details as generic 500s.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  AI_UNAVAILABLE: "AI_UNAVAILABLE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = "You must be signed in to continue.") {
    return new ApiError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  /** Deliberately vague: never reveal whether the email or the password was wrong. */
  static invalidCredentials() {
    return new ApiError(
      401,
      ERROR_CODES.INVALID_CREDENTIALS,
      "Incorrect email or password.",
    );
  }

  static forbidden(message = "You do not have access to this resource.") {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }

  /** Also used when a resource exists but is not visible to this user (avoids leaking existence). */
  static notFound(message = "The requested resource was not found.") {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(409, ERROR_CODES.CONFLICT, message, details);
  }

  static rateLimited(message = "Too many requests. Please slow down and try again.") {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static aiUnavailable(message = "The AI provider is unavailable right now.") {
    return new ApiError(503, ERROR_CODES.AI_UNAVAILABLE, message);
  }

  static serviceUnavailable(message = "The service is temporarily unavailable.") {
    return new ApiError(503, ERROR_CODES.SERVICE_UNAVAILABLE, message);
  }

  static internal(message = "Something went wrong on our end.") {
    return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }
}
