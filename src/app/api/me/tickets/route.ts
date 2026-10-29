import type { NextRequest } from "next/server";
import { ApiError } from "@/server/http/ApiError";
import { parseQuery, readJson } from "@/server/http/request";
import { created, handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import {
  createTicket,
  listAuthorTickets,
} from "@/server/services/tickets.service";
import { authorTicketQuerySchema } from "@/shared/schemas/filters";
import { createTicketSchema } from "@/shared/schemas/ticket";

/**
 * GET  /api/me/tickets  — the caller's tickets (public messages only)
 * POST /api/me/tickets  — submit a query; classified + prioritised on create
 */

export const GET = handleRoute(async (req: NextRequest) => {
  const user = await requireRole("author");
  if (!user.authorId) {
    throw ApiError.forbidden("Your login is not linked to an author profile.");
  }

  const query = authorTicketQuerySchema.parse(parseQuery(req));
  const page = await listAuthorTickets(user.authorId, query);

  return ok({ items: page.items }, {
    page: page.page,
    limit: page.limit,
    total: page.total,
  });
});

export const POST = handleRoute(async (req: NextRequest) => {
  const user = await requireRole("author");
  const input = createTicketSchema.parse(await readJson(req));

  // AI classification runs inside `createTicket` and always resolves — a
  // provider failure degrades to the rules path, it never blocks the 201.
  const ticket = await createTicket({ user, input, signal: req.signal });

  return created({ ticket });
});
