import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/shared/constants";
import { loginSchema } from "@/shared/schemas/auth";
import { signSession } from "@/server/auth/jwt";
import { sessionCookieOptions } from "@/server/auth/session";
import { ApiError } from "@/server/http/ApiError";
import { clientKey, readJson } from "@/server/http/request";
import { loginLimiter } from "@/server/http/rateLimit";
import { handleRoute, ok } from "@/server/http/respond";
import { authenticate } from "@/server/services/auth.service";

/**
 * POST /api/auth/login
 * Validates credentials, signs a JWT, and sets it as an httpOnly cookie.
 * Responds 401 with a deliberately generic message on failure.
 */
export const POST = handleRoute(async (req: NextRequest) => {
  const { email, password } = loginSchema.parse(await readJson(req));

  const limit = loginLimiter.check(clientKey(req, email));
  if (!limit.allowed) {
    throw ApiError.rateLimited(
      `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds}s.`,
    );
  }

  const user = await authenticate(email, password);
  if (!user) throw ApiError.invalidCredentials();

  const token = await signSession({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    authorId: user.authorId,
  });

  const res = ok({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
