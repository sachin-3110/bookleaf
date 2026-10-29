import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getCurrentUser } from "@/server/middleware/guard";

const NAV: NavItem[] = [
  { href: "/books", label: "My Books" },
  { href: "/tickets", label: "My Tickets" },
  { href: "/tickets/new", label: "Submit Query" },
];

/**
 * Guarded layout for the author portal.
 * Server-side check mirrors the API guards: anything not an author is bounced
 * to the login screen (unauthenticated) or the admin console (wrong role).
 */
export default async function AuthorLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "author") redirect("/admin");

  return (
    <AppShell user={user} section="Author Portal" nav={NAV}>
      {children}
    </AppShell>
  );
}
