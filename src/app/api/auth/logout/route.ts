import { SESSION_COOKIE } from "@/shared/constants";
import { sessionCookieOptions } from "@/server/auth/session";
import { handleRoute, ok } from "@/server/http/respond";

/**
 * POST /api/auth/logout
 *
 * Idempotent on purpose: it always clears the cookie and returns 200, so a
 * client holding an already-expired session can still sign out cleanly.
 */
export const POST = handleRoute(async () => {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
});
