import { readSessionToken } from "@/server/auth/session";
import { verifySession } from "@/server/auth/jwt";
import { ApiError } from "@/server/http/ApiError";
import type { Role } from "@/shared/constants";
import type { SessionUser } from "@/shared/types";

/**
 * Auth/RBAC guards.
 *
 * These are plain functions rather than higher-order wrappers so that Route
 * Handlers keep Next.js's exact expected signature (including the async
 * `{ params }` context) with no generic gymnastics:
 *
 *   export const GET = handleRoute(async () => {
 *     const user = await requireUser();
 *     ...
 *   });
 *
 * Identity always comes from the signed cookie — a client-supplied
 * `author_id` in a body or query string is ignored.
 */

/** Returns the signed-in user, or `null` when there is no valid session. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return verifySession(token);
}

/** Throws 401 when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const token = await readSessionToken();
  if (!token) throw ApiError.unauthenticated();
  const user = await verifySession(token);
  if (!user) {
    throw ApiError.unauthenticated("Your session has expired. Please sign in again.");
  }
  return user;
}

/** Throws 401 then 403, and returns the user so callers can use `user.id`. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    throw ApiError.forbidden(
      role === "admin"
        ? "Administrator access is required."
        : "This area is for authors.",
    );
  }
  return user;
}
