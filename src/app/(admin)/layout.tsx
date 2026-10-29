import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getCurrentUser } from "@/server/middleware/guard";

const NAV: NavItem[] = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/stats", label: "Overview" },
];

/** Guarded layout for the admin console — admins only. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/books");

  return (
    <AppShell user={user} section="Admin Console" nav={NAV}>
      {children}
    </AppShell>
  );
}
