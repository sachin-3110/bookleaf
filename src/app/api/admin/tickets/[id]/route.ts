import type { NextRequest } from "next/server";
import { readJson } from "@/server/http/request";
import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { getAdminTicket, updateTicket } from "@/server/services/tickets.service";
import { updateTicketSchema } from "@/shared/schemas/ticket";

/**
 * GET   /api/admin/tickets/:id  — full detail (internal notes, events, AI draft)
 * PATCH /api/admin/tickets/:id  — status / category / priority / assignment
 *
 * GET is not side-effect-free by accident: the first time an admin opens a
 * ticket, the AI draft is generated and cached on the ticket. That is the
 * deliberate cost decision — one draft per ticket, never before it is needed.
 */
export const GET = handleRoute(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireRole("admin");
    const { id } = await ctx.params;

    const { ticket, draftGenerated } = await getAdminTicket(id, {
      signal: req.signal,
    });

    return ok({ ticket }, { draftGenerated });
  },
);

export const PATCH = handleRoute(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("admin");
    const input = updateTicketSchema.parse(await readJson(req));
    const { id } = await ctx.params;

    const ticket = await updateTicket(user, id, input);
    return ok({ ticket });
  },
);
