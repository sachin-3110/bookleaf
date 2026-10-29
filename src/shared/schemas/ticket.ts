import { z } from "zod";
import {
  CLASSIFICATION_SOURCES,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from "@/shared/constants";

/** Zod schemas for ticket payloads (author create + admin mutate). */

/** Attachment metadata is UI-only in this build (no binary upload). */
export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().nonnegative(),
  type: z.string().trim().min(1).max(120),
});

export const createTicketSchema = z.object({
  book_id: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .default(null),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters.")
    .max(120, "Subject must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue in at least 10 characters.")
    .max(4000, "Description must be 4000 characters or fewer."),
  attachments: z.array(attachmentSchema).max(5, "Up to 5 attachments.").optional().default([]),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Author follow-up message on their own ticket. */
export const createAuthorMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty.").max(4000),
});

/** Admin reply and/or internal note. */
export const createAdminMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty.").max(5000),
  visibility: z.enum(["public", "internal"]).default("public"),
});
export type CreateAdminMessageInput = z.infer<typeof createAdminMessageSchema>;

/**
 * Admin patch. Every field is optional, but at least one must be present —
 * an empty PATCH is a client bug, not a no-op.
 *
 * `reopen: true` is the explicit escape hatch for moving a ticket out of the
 * terminal `Closed` state (see the transition rule in tickets.service.ts).
 */
export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignSelf: z.boolean().optional(),
    assignedTo: z.string().nullable().optional(),
    reopen: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Provide at least one field to update.",
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/** Manual AI (re)generation. */
export const aiRunSchema = z.object({
  mode: z.enum(["draft", "classify"]).default("draft"),
});

export type ClassificationSourceValue = (typeof CLASSIFICATION_SOURCES)[number];
