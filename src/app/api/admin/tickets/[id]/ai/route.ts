import type { NextRequest } from "next/server";
import { ApiError } from "@/server/http/ApiError";
import { clientKey, readJson } from "@/server/http/request";
import { aiLimiter } from "@/server/http/rateLimit";
import { handleRoute, ok } from "@/server/http/respond";
import { requireRole } from "@/server/middleware/guard";
import {
  regenerateDraft,
  rerunClassification,
} from "@/server/services/tickets.service";
import { aiRunSchema } from "@/shared/schemas/ticket";

/**
 * POST /api/admin/tickets/:id/ai
 *
 * Explicit (re)generation, behind the AI rate limiter because it is the only
 * endpoint that can burn tokens on demand.
 *
 *  - `mode: 'draft'`    → regenerate and re-cache the draft.
 *  - `mode: 'classify'` → re-run classification. If an admin has already set
 *    the category or priority by hand, the fresh suggestion is returned but
 *    **not** applied (`applied: false`) — a human decision is not silently
 *    overwritten by a machine one.
 */
export const POST = handleRoute(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("admin");

    const limit = aiLimiter.check(clientKey(req, user.id));
    if (!limit.allowed) {
      throw ApiError.rateLimited(
        `Too many AI requests. Try again in ${limit.retryAfterSeconds}s.`,
      );
    }

    const { mode } = aiRunSchema.parse(await readJson(req));
    const { id } = await ctx.params;

    if (mode === "classify") {
      const result = await rerunClassification(user, id, req.signal);
      return ok({
        ticket: result.ticket,
        classification: result.classification,
        applied: result.applied,
      });
    }

    const result = await regenerateDraft(user, id, req.signal);
    return ok({ ticket: result.ticket, draft: result.draft });
  },
);
