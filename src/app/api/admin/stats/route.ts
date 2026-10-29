import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { getTicketStats } from "@/server/services/tickets.service";

/** GET /api/admin/stats — counts by status / category / priority for the overview. */
export const GET = handleRoute(async () => {
  await requireRole("admin");
  const stats = await getTicketStats();
  return ok({ stats });
});
