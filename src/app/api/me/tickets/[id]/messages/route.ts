import type { NextRequest } from "next/server";
import { readJson } from "@/server/http/request";
import { created, handleRoute } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { addAuthorMessage } from "@/server/services/tickets.service";
import { createAuthorMessageSchema } from "@/shared/schemas/ticket";

/**
 * POST /api/me/tickets/:id/messages
 *
 * Author follow-up on their own ticket. Replying to a Resolved/Closed ticket
 * reopens it (handled in the service) rather than silently appending to a
 * dead thread.
 */
export const POST = handleRoute(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("author");
    const { body } = createAuthorMessageSchema.parse(await readJson(req));
    const { id } = await ctx.params;

    const ticket = await addAuthorMessage(user, id, body);
    return created({ ticket });
  },
);
