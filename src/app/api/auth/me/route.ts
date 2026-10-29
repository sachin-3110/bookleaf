import { ApiError } from "@/server/http/ApiError";
import { handleRoute, ok } from "@/server/http/respond";
import { requireUser } from "@/server/middleware/guard";
import { findUserById } from "@/server/services/auth.service";

/**
 * GET /api/auth/me
 *
 * The token proves who signed in; the database confirms the account still
 * exists (e.g. after a re-seed), so a stale cookie cannot impersonate a
 * deleted user.
 */
export const GET = handleRoute(async () => {
  const session = await requireUser();
  const user = await findUserById(session.id);
  if (!user) {
    throw ApiError.unauthenticated("Your account is no longer available.");
  }
  return ok({ user });
});
