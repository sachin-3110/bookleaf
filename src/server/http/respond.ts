import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, ERROR_CODES } from "./ApiError";

/**
 * HTTP response helpers + the single place where thrown errors become
 * responses. Route handlers stay thin: they call `handleRoute`, throw
 * `ApiError`s (or Zod errors) freely, and never write error JSON themselves.
 */

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status: 200 });
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status: 201 });
}

function zodDetails(err: ZodError) {
  return err.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/** Detects a database/connectivity failure so it becomes a 503, not a 500. */
function isConnectionError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return (
    name === "MongoServerSelectionError" ||
    name === "MongooseServerSelectionError" ||
    name === "MongoNetworkError" ||
    name === "MongoTimeoutError"
  );
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      { status: err.status },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "The request contains invalid fields.",
          details: zodDetails(err),
        },
      },
      { status: 400 },
    );
  }

  if (isConnectionError(err)) {
    console.error("[api] database unavailable:", err);
    return NextResponse.json(
      {
        error: {
          code: ERROR_CODES.SERVICE_UNAVAILABLE,
          message: "The database is unreachable. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  }

  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "Something went wrong on our end.",
      },
    },
    { status: 500 },
  );
}

/**
 * Wraps a Route Handler so that anything thrown becomes a correct HTTP
 * response. The variadic `...args` keeps the exact signature Next.js expects
 * (including the `{ params }` context of dynamic routes).
 */
export function handleRoute<A extends unknown[]>(
  handler: (req: NextRequest, ...args: A) => Promise<Response>,
): (req: NextRequest, ...args: A) => Promise<Response> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
