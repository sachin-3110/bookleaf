import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/shared/constants";

/**
 * Proxy (Next.js 16's renamed `middleware`).
 *
 * This performs an **optimistic** check only — it looks for the presence of the
 * session cookie and redirects, which avoids a DB/verify round-trip on every
 * request. Authoritative checks (signature verification + role enforcement)
 * happen close to the data: in the route guards and the guarded layouts.
 *
 * `src/proxy.ts` sits next to `app/`, per the file convention.
 */

const PROTECTED_PREFIXES = ["/books", "/tickets", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isProtected(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Already signed in: skip the login screen.
  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/books/:path*", "/tickets/:path*", "/admin/:path*"],
};
