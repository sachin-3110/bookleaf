import { cookies } from "next/headers";
import { env } from "@/server/config/env";
import { SESSION_COOKIE } from "@/shared/constants";

const FALLBACK_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Parses `"7d" | "12h" | "30m" | "60s"` into seconds. */
function parseDuration(value: string): number | null {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return amount * multiplier;
}

export function sessionMaxAgeSeconds(): number {
  return parseDuration(env().JWT_EXPIRES_IN) ?? FALLBACK_MAX_AGE;
}

/**
 * Cookie flags. `httpOnly` blocks JS access, `sameSite=lax` blocks cross-site
 * POSTs (CSRF), and `secure` is enabled automatically in production.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  };
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
