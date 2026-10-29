import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "@/server/config/env";
import { ROLES, SESSION_COOKIE } from "@/shared/constants";
import type { SessionUser } from "@/shared/types";

/**
 * Stateless sessions: a signed JWT carried in an httpOnly cookie.
 *
 * Why JWT-in-a-cookie instead of a server session table?
 *  - No session store to run, and it survives serverless cold starts.
 *  - httpOnly + sameSite=lax keeps it out of JS reach and blocks CSRF on
 *    state-changing navigations.
 * The trade-off (no instant revocation) is documented in 06-feature-decisions.
 */

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  return encoder.encode(env().JWT_SECRET);
}

/** Claims we put in the token. Identity is derived from here — never from the request. */
const claimsSchema = z.object({
  role: z.enum(ROLES),
  name: z.string(),
  email: z.string(),
  authorId: z.string().nullable(),
});

export interface SessionClaims {
  userId: string;
  role: SessionUser["role"];
  name: string;
  email: string;
  authorId: string | null;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    name: claims.name,
    email: claims.email,
    authorId: claims.authorId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(env().JWT_EXPIRES_IN)
    .sign(secretKey());
}

/** Verifies the token; returns `null` for anything invalid or expired. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success || typeof payload.sub !== "string") return null;

    return {
      id: payload.sub,
      role: parsed.data.role,
      name: parsed.data.name,
      email: parsed.data.email,
      authorId: parsed.data.authorId ?? null,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
