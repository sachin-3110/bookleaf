import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/middleware/guard";

/**
 * Entry point: routes the signed-in user to the right portal by role.
 * Unauthenticated visitors are sent to the login screen.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/admin" : "/books");
}
