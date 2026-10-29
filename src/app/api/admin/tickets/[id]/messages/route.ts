import type { NextRequest } from "next/server";
import { readJson } from "@/server/http/request";
import { created, handleRoute } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { addAdminMessage } from "@/server/services/tickets.service";
import { createAdminMessageSchema } from "@/shared/schemas/ticket";

/**
 * POST /api/admin/tickets/:id/messages
 *
 * `visibility: 'public'` sends a reply the author will see on their next poll.
 * `visibility: 'internal'` records an internal note that is filtered out of
 * every `/api/me/*` response.
 */
export const POST = handleRoute(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("admin");
    const input = createAdminMessageSchema.parse(await readJson(req));
    const { id } = await ctx.params;

    const ticket = await addAdminMessage(user, id, input);
    return created({ ticket });
  },
);
