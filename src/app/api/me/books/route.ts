import { ApiError } from "@/server/http/ApiError";
import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import { listAuthorBooks } from "@/server/services/books.service";

/**
 * GET /api/me/books
 *
 * The caller's books plus dashboard totals. Totals are computed on read (never
 * stored) and cover published titles only — in-production books have no
 * earnings yet, and showing an estimate beside real money would be misleading.
 */
export const GET = handleRoute(async () => {
  const user = await requireRole("author");
  if (!user.authorId) {
    throw ApiError.forbidden("Your login is not linked to an author profile.");
  }

  const { books, totals } = await listAuthorBooks(user.authorId);
  return ok({ books, totals });
});
