"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/lib/endpoints";
import type { SessionUser } from "@/shared/types";

export interface NavItem {
  href: string;
  label: string;
}

interface AppShellProps {
  user: SessionUser;
  /** Small label next to the wordmark, e.g. "Author Portal" / "Admin Console". */
  section: string;
  nav: NavItem[];
  children: ReactNode;
}

/**
 * Shared application chrome. A hairline header, an inline nav, and the
 * signed-in identity with a sign-out action — deliberately flat (no sidebar
 * chrome, no heavy surfaces) so the content carries the page.
 */
export function AppShell({ user, section, nav, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" || href === "/books" || href === "/tickets"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Even if the call fails the cookie is cleared client-side by the redirect.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="hairline-b sticky top-0 z-10 bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-6">
          <div className="flex items-baseline gap-2.5">
            <Link href="/" className="font-display text-[15px] tracking-tight">BookLeaf</Link>
          </div>

          <nav className="ml-6 hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                  isActive(item.href)
                    ? "bg-sunken text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[12px] text-ink">{user.name}</div>
              <div className="text-[11px] text-faint">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="btn btn-ghost"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
