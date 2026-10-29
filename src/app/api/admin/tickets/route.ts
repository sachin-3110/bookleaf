import type { NextRequest } from "next/server";
import { parseQuery } from "@/server/http/request";
import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { listAdminTickets } from "@/server/services/tickets.service";
import { adminTicketQuerySchema } from "@/shared/schemas/filters";

/**
 * GET /api/admin/tickets
 *
 * The support queue. Supports `status, category, priority, assignedTo, from,
 * to, q` filters and `sort` — defaulting to `urgency`, which is the product's
 * core idea: unresolved first, then most urgent, then oldest.
 */
export const GET = handleRoute(async (req: NextRequest) => {
  const user = await requireRole("admin");
  const query = adminTicketQuerySchema.parse(parseQuery(req));
  const page = await listAdminTickets(query, user.id);

  return ok({ items: page.items }, {
    page: page.page,
    limit: page.limit,
    total: page.total,
    sort: query.sort,
  });
});
