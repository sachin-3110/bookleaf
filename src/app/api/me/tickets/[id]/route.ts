import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { getAuthorTicket } from "@/server/services/tickets.service";
import { ApiError } from "@/server/http/ApiError";

/**
 * GET /api/me/tickets/:id
 *
 * Scoped to the caller's own tickets. A ticket that exists but belongs to
 * someone else returns **404, not 403** — the API must not confirm that
 * another author's ticket id exists.
 */
export const GET = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("author");
    if (!user.authorId) {
      throw ApiError.forbidden("Your login is not linked to an author profile.");
    }

    const { id } = await ctx.params;
    const ticket = await getAuthorTicket(user.authorId, id);
    return ok({ ticket });
  },
);
