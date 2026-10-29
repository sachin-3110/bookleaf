import mongoose, { Types } from "mongoose";
import { classifyTicket, draftReply } from "@/server/services/ai.service";
import { connectDB } from "@/server/db/connect";
import { ApiError } from "@/server/http/ApiError";
import { Author, type AuthorDoc } from "@/server/models/Author";
import { Book, type BookDoc } from "@/server/models/Book";
import { User } from "@/server/models/User";
import { nextSequence } from "@/server/models/Counter";
import {
  Ticket,
  type AiDraftSubdoc,
  type AiMetaSubdoc,
  type AttachmentSubdoc,
  type EventSubdoc,
  type MessageSubdoc,
  type TicketDoc,
} from "@/server/models/Ticket";
import type { TicketAiContext } from "@/server/ai/types";
import type {
  AdminTicketQuery,
  AuthorTicketQuery,
  TicketSort,
} from "@/shared/schemas/filters";
import type {
  CreateAdminMessageInput,
  CreateTicketInput,
  UpdateTicketInput,
} from "@/shared/schemas/ticket";
import {
  PRIORITIES,
  TICKET_STATUSES,
  type ClassificationSource,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/shared/constants";
import type {
  AiDraftDTO,
  AttachmentMeta,
  ClassificationSummary,
  MessageDTO,
  Paginated,
  SessionUser,
  TicketDTO,
  TicketEventDTO,
  TicketStats,
} from "@/shared/types";

/**
 * Ticket business logic.
 *
 * The whole file follows one rule: **routes never touch Mongoose, and services
 * never touch HTTP**. Everything here takes plain data in and returns DTOs or
 * throws `ApiError` — so the route layer stays a two-liner and the same logic
 * is reusable and testable.
 *
 * Author scoping is always derived from the session (`authorId`), never from a
 * client-supplied field. A ticket that exists but belongs to someone else
 * returns **404, not 403**, so the API never confirms that another author's
 * ticket id is real.
 */

const TICKET_COUNTER = "ticketId";

/** Event types an author may see on their own ticket (the rest are internal). */
const AUTHOR_VISIBLE_EVENTS = new Set([
  "created",
  "status_changed",
  "reply_sent",
  "reopened",
]);

// ---------------------------------------------------------------------------
// Hydration + DTO mapping
// ---------------------------------------------------------------------------

/**
 * A ticket plus the denormalised display names the DTO needs. Producing this
 * in one shape means the aggregation path (queue) and the find path (detail)
 * go through exactly the same mapper.
 */
interface HydratedTicket {
  _id: Types.ObjectId;
  ticketId: string;
  author_id: string;
  book_id: string | null;
  subject: string;
  description: string;
  attachments: AttachmentSubdoc[];
  category: TicketCategory;
  categorySource: ClassificationSource;
  categoryConfidence: number | null;
  priority: TicketPriority;
  prioritySource: ClassificationSource;
  aiOriginal: { category: TicketCategory; priority: TicketPriority } | null;
  status: TicketStatus;
  aiDraft: AiDraftSubdoc | null;
  aiMeta: AiMetaSubdoc | null;
  messages: MessageSubdoc[];
  events: EventSubdoc[];
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  authorName: string;
  bookTitle: string | null;
  assignedToName: string | null;
}

function toMessageDTO(message: MessageSubdoc): MessageDTO {
  return {
    id: String(message._id ?? ""),
    senderRole: message.senderRole,
    senderName: message.senderName,
    body: message.body,
    visibility: message.visibility,
    createdAt: (message.createdAt ?? new Date()).toISOString(),
  };
}

function toEventDTO(event: EventSubdoc): TicketEventDTO {
  return {
    id: String(event._id ?? ""),
    type: event.type,
    actorRole: event.actorRole,
    actorId: event.actorId ?? null,
    from: event.from ?? null,
    to: event.to ?? null,
    note: event.note ?? null,
    createdAt: (event.createdAt ?? new Date()).toISOString(),
  };
}

function toAttachmentMeta(attachment: AttachmentSubdoc): AttachmentMeta {
  return { name: attachment.name, size: attachment.size, type: attachment.type };
}

function toAiDraftDTO(draft: AiDraftSubdoc | null): AiDraftDTO | null {
  if (!draft) return null;
  return {
    body: draft.body,
    model: draft.model,
    generatedAt: draft.generatedAt.toISOString(),
    fallback: draft.fallback,
  };
}

/**
 * `includeInternal: false` is the author view: internal notes are dropped, the
 * AI draft is never exposed (it is an internal tool), and only author-safe
 * audit events are returned.
 */
function toTicketDTO(
  ticket: HydratedTicket,
  opts: { includeInternal: boolean },
): TicketDTO {
  const messages = ticket.messages
    .filter((m) => opts.includeInternal || m.visibility !== "internal")
    .map(toMessageDTO);

  const events = ticket.events
    .filter((e) => opts.includeInternal || AUTHOR_VISIBLE_EVENTS.has(e.type))
    .map(toEventDTO);

  return {
    id: String(ticket._id),
    ticketId: ticket.ticketId,
    author_id: ticket.author_id,
    authorName: ticket.authorName,
    book_id: ticket.book_id,
    bookTitle: ticket.bookTitle,
    subject: ticket.subject,
    description: ticket.description,
    attachments: ticket.attachments.map(toAttachmentMeta),
    category: ticket.category,
    categorySource: ticket.categorySource,
    categoryConfidence: ticket.categoryConfidence ?? null,
    priority: ticket.priority,
    prioritySource: ticket.prioritySource,
    aiOriginal: ticket.aiOriginal ?? null,
    status: ticket.status,
    assignedTo: null,
    assignedToName: ticket.assignedToName,
    aiDraft: opts.includeInternal ? toAiDraftDTO(ticket.aiDraft) : null,
    messages,
    events,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastActivityAt: ticket.lastActivityAt.toISOString(),
  };
}

/** Attaches display names to a lean ticket document. */
async function hydrate(
  doc: TicketDoc & { assignedTo?: unknown },
  preloaded?: { authorName?: string; bookTitle?: string | null },
): Promise<HydratedTicket> {
  const populatedAssignee = doc.assignedTo as { name?: string } | null;

  const [authorName, bookTitle] = await Promise.all([
    preloaded?.authorName !== undefined
      ? Promise.resolve(preloaded.authorName)
      : Author.findOne({ author_id: doc.author_id })
          .select("name")
          .lean()
          .then((a) => a?.name ?? "Unknown author"),
    preloaded?.bookTitle !== undefined
      ? Promise.resolve(preloaded.bookTitle)
      : doc.book_id
        ? Book.findOne({ book_id: doc.book_id })
            .select("title")
            .lean()
            .then((b) => b?.title ?? null)
        : Promise.resolve(null),
  ]);

  return {
    ...(doc as unknown as HydratedTicket),
    authorName,
    bookTitle,
    assignedToName: populatedAssignee?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// AI context
// ---------------------------------------------------------------------------

/**
 * Builds the (deliberately small) context the model is allowed to see.
 * No message history, no other authors' data — only this ticket's own facts.
 */
export async function buildTicketContext(
  input: {
    subject: string;
    description: string;
    author_id: string;
    book_id: string | null;
  },
  preloaded?: { author?: AuthorDoc | null; book?: BookDoc | null },
): Promise<TicketAiContext> {
  const [author, book] = await Promise.all([
    preloaded?.author !== undefined
      ? Promise.resolve(preloaded.author)
      : (Author.findOne({ author_id: input.author_id }).lean() as Promise<AuthorDoc | null>),
    preloaded?.book !== undefined
      ? Promise.resolve(preloaded.book)
      : input.book_id
        ? (Book.findOne({ book_id: input.book_id }).lean() as Promise<BookDoc | null>)
        : Promise.resolve(null),
  ]);

  const dateOnly = (value: Date | null | undefined) =>
    value ? value.toISOString().slice(0, 10) : null;

  return {
    subject: input.subject,
    description: input.description,
    bookTitle: book?.title ?? null,
    bookStatus: book?.status ?? null,
    bookGenre: book?.genre ?? null,
    isbn: book?.isbn ?? null,
    authorName: author?.name ?? null,
    authorCity: author?.city ?? null,
    authorJoinedDate: dateOnly(author?.joined_date),
    earned: book?.total_royalty_earned ?? null,
    paid: book?.royalty_paid ?? null,
    pending: book?.royalty_pending ?? null,
    lastPayoutDate: dateOnly(book?.last_royalty_payout_date),
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a ticket and classifies it.
 *
 * Classification is awaited (the queue's default sort depends on priority
 * being right from the first poll) but it can never fail the request: the AI
 * service always resolves, degrading to `categorySource: 'rule'`.
 */
export async function createTicket(params: {
  user: SessionUser;
  input: CreateTicketInput;
  signal?: AbortSignal;
}): Promise<TicketDTO> {
  await connectDB();

  const authorId = params.user.authorId;
  if (!authorId) {
    throw ApiError.forbidden(
      "Your login is not linked to an author profile. Please contact BookLeaf support.",
    );
  }

  // Data-level RBAC: the book must belong to the caller. A client-supplied
  // book_id for someone else's title is rejected here, not trusted.
  let book: BookDoc | null = null;
  if (params.input.book_id) {
    book = await Book.findOne({
      book_id: params.input.book_id,
      author_id: authorId,
    }).lean() as BookDoc | null;
    if (!book) {
      throw ApiError.badRequest(
        "That book is not on your account. Pick one of your own titles, or submit a general query.",
      );
    }
  }

  const author = (await Author.findOne({ author_id: authorId }).lean()) as AuthorDoc | null;
  const context = await buildTicketContext(
    {
      subject: params.input.subject,
      description: params.input.description,
      author_id: authorId,
      book_id: book?.book_id ?? null,
    },
    { author, book },
  );

  const classification = await classifyTicket(context, params.signal);

  const seq = await nextSequence(TICKET_COUNTER);
  const now = new Date();

  const doc = await Ticket.create({
    ticketId: `TK-${seq}`,
    author_id: authorId,
    book_id: book?.book_id ?? null,
    subject: params.input.subject,
    description: params.input.description,
    attachments: params.input.attachments,

    category: classification.category,
    categorySource: classification.source,
    categoryConfidence: classification.confidence,
    priority: classification.priority,
    prioritySource: classification.source,
    // Snapshot of the automated read, so an admin override stays auditable.
    aiOriginal: {
      category: classification.category,
      priority: classification.priority,
    },

    status: "Open",
    aiMeta: classification.meta,
    events: [
      {
        type: "created",
        actorRole: "author",
        actorId: params.user.id,
        note: "Ticket submitted.",
      },
      {
        type: "classified",
        actorRole: "system",
        to: `${classification.category} / ${classification.priority}`,
        note: classification.reason,
      },
    ],
    lastActivityAt: now,
  });

  const lean = (await Ticket.findById(doc._id).lean()) as TicketDoc;
  const hydrated = await hydrate(lean, {
    authorName: author?.name ?? params.user.name,
    bookTitle: book?.title ?? null,
  });
  return toTicketDTO(hydrated, { includeInternal: false });
}

// ---------------------------------------------------------------------------
// Author reads
// ---------------------------------------------------------------------------

export async function listAuthorTickets(
  authorId: string,
  query: AuthorTicketQuery,
): Promise<Paginated<TicketDTO>> {
  await connectDB();

  const filter: Record<string, unknown> = { author_id: authorId };
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  const tickets = (docs as TicketDoc[]).map((d) => hydrate(d));
  const hydrated = await Promise.all(tickets);

  return {
    items: hydrated.map((t) => toTicketDTO(t, { includeInternal: false })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getAuthorTicket(
  authorId: string,
  ticketId: string,
): Promise<TicketDTO> {
  await connectDB();

  // Scoped query — a ticket belonging to another author simply is not found.
  const doc = (await Ticket.findOne({ ticketId, author_id: authorId }).lean()) as
    | TicketDoc
    | null;
  if (!doc) throw ApiError.notFound("That ticket was not found on your account.");

  const hydrated = await hydrate(doc);
  return toTicketDTO(hydrated, { includeInternal: false });
}

/**
 * Author follow-up. Replying to a Resolved/Closed ticket reopens it — the
 * alternative (silently adding to a closed thread) loses the work.
 */
export async function addAuthorMessage(
  user: SessionUser,
  ticketId: string,
  body: string,
): Promise<TicketDTO> {
  await connectDB();

  const authorId = user.authorId;
  if (!authorId) throw ApiError.forbidden("Your login is not linked to an author profile.");

  const doc = await Ticket.findOne({ ticketId, author_id: authorId });
  if (!doc) throw ApiError.notFound("That ticket was not found on your account.");

  const now = new Date();
  const senderName = user.name;

  doc.messages.push({
    senderRole: "author",
    senderId: user.id,
    senderName,
    body,
    visibility: "public",
  });

  if (doc.status === "Resolved" || doc.status === "Closed") {
    const from = doc.status;
    doc.status = "Open";
    doc.events.push({
      type: "reopened",
      actorRole: "author",
      actorId: user.id,
      from,
      to: "Open",
      note: "Reopened by the author with a follow-up message.",
    });
  }

  doc.lastActivityAt = now;
  await doc.save();

  const lean = (await Ticket.findById(doc._id).lean()) as TicketDoc;
  return toTicketDTO(await hydrate(lean), { includeInternal: false });
}

// ---------------------------------------------------------------------------
// Admin: queue
// ---------------------------------------------------------------------------

/** Escapes user text before it reaches a `$regex` (no ReDoS, no injection). */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `$switch` that maps an enum field to its documented sort rank. */
function rankExpression(field: string, order: readonly string[]) {
  return {
    $switch: {
      branches: order.map((value, index) => ({
        case: { $eq: [`$${field}`, value] },
        then: index,
      })),
      default: order.length,
    },
  };
}

function parseDateBoundary(value: string, endOfDay: boolean): Date {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const iso = isDateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`"${value}" is not a valid date. Use YYYY-MM-DD or ISO-8601.`);
  }
  return date;
}

function buildAdminFilter(
  query: AdminTicketQuery,
  viewerId: string,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;

  if (query.assignedTo === "me") {
    filter.assignedTo = new Types.ObjectId(viewerId);
  } else if (query.assignedTo === "none" || query.assignedTo === "unassigned") {
    filter.assignedTo = null;
  } else if (query.assignedTo) {
    if (!mongoose.isValidObjectId(query.assignedTo)) {
      throw ApiError.badRequest("assignedTo must be a user id, 'me' or 'unassigned'.");
    }
    filter.assignedTo = new Types.ObjectId(query.assignedTo);
  }

  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.$gte = parseDateBoundary(query.from, false);
    if (query.to) createdAt.$lte = parseDateBoundary(query.to, true);
    filter.createdAt = createdAt;
  }

  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ subject: rx }, { description: rx }, { ticketId: rx }];
  }

  return filter;
}

const SORT_STAGES: Record<TicketSort, Record<string, 1 | -1>> = {
  // The product's default: unresolved first, most urgent first, oldest first.
  urgency: { __statusRank: 1, __priorityRank: 1, createdAt: 1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { lastActivityAt: -1 },
};

export async function listAdminTickets(
  query: AdminTicketQuery,
  viewerId: string,
): Promise<Paginated<TicketDTO>> {
  await connectDB();

  const filter = buildAdminFilter(query, viewerId);
  const skip = (query.page - 1) * query.limit;

  const [result] = await Ticket.aggregate<{
    items: HydratedTicket[];
    total: { value: number }[];
  }>([
    { $match: filter },
    {
      $addFields: {
        __statusRank: rankExpression("status", TICKET_STATUSES),
        __priorityRank: rankExpression("priority", PRIORITIES),
      },
    },
    { $sort: SORT_STAGES[query.sort] },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $lookup: {
              from: "authors",
              localField: "author_id",
              foreignField: "author_id",
              as: "__author",
            },
          },
          {
            $lookup: {
              from: "books",
              localField: "book_id",
              foreignField: "book_id",
              as: "__book",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "assignedTo",
              foreignField: "_id",
              as: "__admin",
            },
          },
          {
            $addFields: {
              authorName: { $ifNull: [{ $first: "$__author.name" }, "Unknown author"] },
              bookTitle: { $ifNull: [{ $first: "$__book.title" }, null] },
              assignedToName: { $ifNull: [{ $first: "$__admin.name" }, null] },
            },
          },
          { $project: { __author: 0, __book: 0, __admin: 0 } },
        ],
        total: [{ $count: "value" }],
      },
    },
  ]);

  const items = (result?.items ?? []).map((t) =>
    toTicketDTO(t, { includeInternal: true }),
  );

  return {
    items,
    page: query.page,
    limit: query.limit,
    total: result?.total?.[0]?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Admin: detail (with the lazy AI draft)
// ---------------------------------------------------------------------------

/**
 * Loads a ticket for an admin. If no draft is cached, one is generated now —
 * "lazily on open", which is the cost decision in 05-ai-integration §1: most
 * tickets get exactly one draft, ever, and never before someone looks at them.
 */
export async function getAdminTicket(
  ticketId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<{ ticket: TicketDTO; draftGenerated: boolean }> {
  await connectDB();

  const doc = (await Ticket.findOne({ ticketId })
    .populate("assignedTo", "name")
    .lean()) as (TicketDoc & { assignedTo: { name?: string } | null }) | null;
  if (!doc) throw ApiError.notFound("That ticket was not found.");

  let draftGenerated = false;

  if (!doc.aiDraft) {
    const context = await buildTicketContext(doc);
    const draft = await draftReply(context, doc.category, doc.priority, opts.signal);

    await Ticket.updateOne(
      { _id: doc._id },
      {
        $set: {
          aiDraft: {
            body: draft.body,
            model: draft.meta.model,
            generatedAt: draft.meta.lastRunAt,
            fallback: draft.meta.fallback,
          },
        },
      },
    );

    doc.aiDraft = {
      body: draft.body,
      model: draft.meta.model,
      generatedAt: draft.meta.lastRunAt,
      fallback: draft.meta.fallback,
    };
    draftGenerated = true;
  }

  const hydrated = await hydrate(doc);
  return {
    ticket: toTicketDTO(hydrated, { includeInternal: true }),
    draftGenerated,
  };
}

// ---------------------------------------------------------------------------
// Admin: mutation
// ---------------------------------------------------------------------------

/**
 * Status transitions are open by design — support staff move fluidly between
 * Open/In Progress/Resolved — with one exception: **Closed is terminal**. An
 * explicit `reopen: true` is required to bring a closed ticket back, which is
 * what produces the documented `409 CONFLICT`.
 */
function assertTransition(from: TicketStatus, to: TicketStatus, reopen: boolean) {
  if (from === to) return;
  if (from === "Closed" && !reopen) {
    throw ApiError.conflict(
      "This ticket is closed. Send reopen: true to reopen it before changing its status.",
    );
  }
}

export async function updateTicket(
  user: SessionUser,
  ticketId: string,
  input: UpdateTicketInput,
): Promise<TicketDTO> {
  await connectDB();

  const doc = await Ticket.findOne({ ticketId });
  if (!doc) throw ApiError.notFound("That ticket was not found.");

  const now = new Date();
  const events: EventSubdoc[] = [];

  // --- status --------------------------------------------------------------
  if (input.status && input.status !== doc.status) {
    assertTransition(doc.status, input.status, Boolean(input.reopen));
    const from = doc.status;
    const reopening = input.status === "Open" && (from === "Resolved" || from === "Closed");
    doc.status = input.status;
    events.push({
      type: reopening ? "reopened" : "status_changed",
      actorRole: "admin",
      actorId: user.id,
      from,
      to: input.status,
      note: reopening ? "Reopened by the BookLeaf team." : null,
    });
  }

  // --- category / priority (the audit-sensitive part) -----------------------
  const overridingCategory = Boolean(input.category && input.category !== doc.category);
  const overridingPriority = Boolean(input.priority && input.priority !== doc.priority);

  if (overridingCategory || overridingPriority) {
    // Preserve the automated original exactly once, so the queue can always
    // show "AI said X, admin chose Y".
    if (!doc.aiOriginal) {
      doc.aiOriginal = { category: doc.category, priority: doc.priority };
    }
  }

  if (overridingCategory && input.category) {
    events.push({
      type: "category_overridden",
      actorRole: "admin",
      actorId: user.id,
      from: doc.category,
      to: input.category,
      note: "Category overridden by an admin.",
    });
    doc.category = input.category;
    doc.categorySource = "admin";
  }

  if (overridingPriority && input.priority) {
    events.push({
      type: "priority_overridden",
      actorRole: "admin",
      actorId: user.id,
      from: doc.priority,
      to: input.priority,
      note: "Priority overridden by an admin.",
    });
    doc.priority = input.priority;
    doc.prioritySource = "admin";
  }

  // --- assignment ----------------------------------------------------------
  if (input.assignSelf) {
    const from = doc.assignedTo ? String(doc.assignedTo) : null;
    doc.assignedTo = new Types.ObjectId(user.id);
    events.push({
      type: "assigned",
      actorRole: "admin",
      actorId: user.id,
      from,
      to: user.id,
      note: `Assigned to ${user.name}.`,
    });
  } else if (input.assignedTo !== undefined) {
    if (input.assignedTo === null) {
      if (doc.assignedTo) {
        events.push({
          type: "assigned",
          actorRole: "admin",
          actorId: user.id,
          from: String(doc.assignedTo),
          to: null,
          note: "Unassigned.",
        });
      }
      doc.assignedTo = null;
    } else {
      if (!mongoose.isValidObjectId(input.assignedTo)) {
        throw ApiError.badRequest("assignedTo must be a valid user id.");
      }
      const assignee = await User.findOne({
        _id: input.assignedTo,
        role: "admin",
      })
        .select("name")
        .lean();
      if (!assignee) throw ApiError.badRequest("Only administrators can be assigned tickets.");
      events.push({
        type: "assigned",
        actorRole: "admin",
        actorId: user.id,
        from: doc.assignedTo ? String(doc.assignedTo) : null,
        to: input.assignedTo,
        note: `Assigned to ${assignee.name}.`,
      });
      doc.assignedTo = new Types.ObjectId(input.assignedTo);
    }
  }

  if (events.length > 0) {
    doc.events.push(...events);
    doc.lastActivityAt = now;
    await doc.save();
  }

  const lean = (await Ticket.findById(doc._id)
    .populate("assignedTo", "name")
    .lean()) as TicketDoc & { assignedTo: { name?: string } | null };
  return toTicketDTO(await hydrate(lean), { includeInternal: true });
}

export async function addAdminMessage(
  user: SessionUser,
  ticketId: string,
  input: CreateAdminMessageInput,
): Promise<TicketDTO> {
  await connectDB();

  const doc = await Ticket.findOne({ ticketId });
  if (!doc) throw ApiError.notFound("That ticket was not found.");

  const now = new Date();
  doc.messages.push({
    senderRole: "admin",
    senderId: user.id,
    senderName: user.name,
    body: input.body,
    visibility: input.visibility,
  });
  doc.events.push({
    type: input.visibility === "internal" ? "note_added" : "reply_sent",
    actorRole: "admin",
    actorId: user.id,
    note:
      input.visibility === "internal"
        ? "Internal note added."
        : "Reply sent to the author.",
  });
  doc.lastActivityAt = now;
  await doc.save();

  const lean = (await Ticket.findById(doc._id)
    .populate("assignedTo", "name")
    .lean()) as TicketDoc & { assignedTo: { name?: string } | null };
  return toTicketDTO(await hydrate(lean), { includeInternal: true });
}

// ---------------------------------------------------------------------------
// Admin: manual AI run
// ---------------------------------------------------------------------------

export interface ClassifyRunResult {
  ticket: TicketDTO;
  classification: ClassificationSummary;
  /** False when the ticket was already overridden by an admin — we never clobber that. */
  applied: boolean;
}

export async function rerunClassification(
  user: SessionUser,
  ticketId: string,
  signal?: AbortSignal,
): Promise<ClassifyRunResult> {
  await connectDB();

  const doc = await Ticket.findOne({ ticketId });
  if (!doc) throw ApiError.notFound("That ticket was not found.");

  const context = await buildTicketContext(doc);
  const result = await classifyTicket(context, signal);

  // Respect an explicit human decision: if an admin already set the category or
  // priority, surface the fresh suggestion instead of silently overwriting it.
  const humanOwnsIt = doc.categorySource === "admin" || doc.prioritySource === "admin";

  if (!humanOwnsIt) {
    if (!doc.aiOriginal) {
      doc.aiOriginal = { category: doc.category, priority: doc.priority };
    }
    doc.category = result.category;
    doc.priority = result.priority;
    doc.categorySource = result.source;
    doc.prioritySource = result.source;
    doc.categoryConfidence = result.confidence;
    doc.aiMeta = result.meta;
    doc.events.push({
      type: "classified",
      actorRole: "system",
      actorId: user.id,
      to: `${result.category} / ${result.priority}`,
      note: `Re-classified on request. ${result.reason ?? ""}`.trim(),
    });
    await doc.save();
  } else {
    doc.aiMeta = result.meta;
    await doc.save();
  }

  const lean = (await Ticket.findById(doc._id)
    .populate("assignedTo", "name")
    .lean()) as TicketDoc & { assignedTo: { name?: string } | null };

  return {
    ticket: toTicketDTO(await hydrate(lean), { includeInternal: true }),
    classification: {
      category: result.category,
      priority: result.priority,
      confidence: result.confidence,
      reason: result.reason,
      source: result.source,
    },
    applied: !humanOwnsIt,
  };
}

export interface DraftRunResult {
  ticket: TicketDTO;
  draft: AiDraftDTO;
}

export async function regenerateDraft(
  user: SessionUser,
  ticketId: string,
  signal?: AbortSignal,
): Promise<DraftRunResult> {
  await connectDB();

  const doc = await Ticket.findOne({ ticketId });
  if (!doc) throw ApiError.notFound("That ticket was not found.");

  const context = await buildTicketContext(doc);
  const result = await draftReply(context, doc.category, doc.priority, signal);

  doc.aiDraft = {
    body: result.body,
    model: result.meta.model,
    generatedAt: result.meta.lastRunAt,
    fallback: result.meta.fallback,
  };
  doc.events.push({
    type: "ai_draft_regenerated",
    actorRole: "admin",
    actorId: user.id,
    note: result.meta.fallback
      ? "Draft regenerated from the rules template (AI unavailable)."
      : `Draft regenerated with ${result.meta.model}.`,
  });
  await doc.save();

  const lean = (await Ticket.findById(doc._id)
    .populate("assignedTo", "name")
    .lean()) as TicketDoc & { assignedTo: { name?: string } | null };

  return {
    ticket: toTicketDTO(await hydrate(lean), { includeInternal: true }),
    draft: toAiDraftDTO(doc.aiDraft)!,
  };
}

// ---------------------------------------------------------------------------
// Admin: stats
// ---------------------------------------------------------------------------

/**
 * Counts for the overview screen. Grouped in the database rather than in JS so
 * the endpoint stays correct as the collection grows.
 */
export async function getTicketStats(): Promise<TicketStats> {
  await connectDB();

  const [byStatus, byCategory, byPriority, total, unassigned] = await Promise.all([
    Ticket.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Ticket.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$category", n: { $sum: 1 } } },
    ]),
    Ticket.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$priority", n: { $sum: 1 } } },
    ]),
    Ticket.countDocuments(),
    Ticket.countDocuments({ assignedTo: null }),
  ]);

  const toRecord = (rows: { _id: string; n: number }[]) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = row.n;
      return acc;
    }, {});

  return {
    total,
    unassigned,
    byStatus: toRecord(byStatus),
    byCategory: toRecord(byCategory),
    byPriority: toRecord(byPriority),
  };
}
