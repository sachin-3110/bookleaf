import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from "@/shared/constants";

/**
 * Query-string schemas.
 *
 * Query values always arrive as strings, so numbers are coerced and blank
 * values (`?status=`) are normalised to `undefined` rather than failing
 * validation — an empty filter input should mean "no filter".
 */

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

const optionalText = z.preprocess(
  blankToUndefined,
  z.string().trim().max(200).optional(),
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/** Author ticket list: pagination + optional status filter. */
export const authorTicketQuerySchema = paginationSchema.extend({
  status: optionalEnum(TICKET_STATUSES),
});
export type AuthorTicketQuery = z.infer<typeof authorTicketQuerySchema>;

export const TICKET_SORTS = ["urgency", "newest", "oldest", "updated"] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

/** Admin queue filters. Default sort is `urgency` — the product's core idea. */
export const adminTicketQuerySchema = paginationSchema.extend({
  status: optionalEnum(TICKET_STATUSES),
  category: optionalEnum(TICKET_CATEGORIES),
  priority: optionalEnum(PRIORITIES),
  /** `me` = assigned to the caller; otherwise a user id. */
  assignedTo: optionalText,
  /** ISO date (inclusive lower bound on createdAt). */
  from: optionalText,
  /** ISO date (inclusive upper bound on createdAt). */
  to: optionalText,
  /** Free-text search over subject + description. */
  q: optionalText,
  sort: z.preprocess(
    blankToUndefined,
    z.enum(TICKET_SORTS).default("urgency"),
  ),
});
export type AdminTicketQuery = z.infer<typeof adminTicketQuerySchema>;
