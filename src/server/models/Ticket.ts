import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  CLASSIFICATION_SOURCES,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type ClassificationSource,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/shared/constants";

export interface AttachmentSubdoc {
  name: string;
  size: number;
  type: string;
}

export interface MessageSubdoc {
  _id?: Types.ObjectId;
  senderRole: "author" | "admin";
  senderId: string;
  senderName: string;
  body: string;
  /** `internal` notes are never returned by the author-facing endpoints. */
  visibility: "public" | "internal";
  createdAt?: Date;
}

export interface EventSubdoc {
  _id?: Types.ObjectId;
  type: string;
  actorRole: "author" | "admin" | "system";
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
  note?: string | null;
  createdAt?: Date;
}

export interface AiDraftSubdoc {
  body: string;
  model: string;
  generatedAt: Date;
  fallback: boolean;
}

export interface AiMetaSubdoc {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallback: boolean;
  lastRunAt: Date;
}

export interface TicketDoc {
  _id: Types.ObjectId;
  ticketId: string;
  author_id: string;
  /** null => "General / Account Level". */
  book_id: string | null;
  subject: string;
  description: string;
  attachments: AttachmentSubdoc[];

  category: TicketCategory;
  categorySource: ClassificationSource;
  categoryConfidence: number | null;

  priority: TicketPriority;
  prioritySource: ClassificationSource;

  /** Snapshot of the AI's original guess, preserved after an admin override. */
  aiOriginal: { category: TicketCategory; priority: TicketPriority } | null;

  status: TicketStatus;
  assignedTo: Types.ObjectId | null;

  aiDraft: AiDraftSubdoc | null;
  aiMeta: AiMetaSubdoc | null;

  messages: MessageSubdoc[];
  events: EventSubdoc[];

  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

const attachmentSchema = new Schema<AttachmentSubdoc>(
  {
    name: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageSubdoc>(
  {
    senderRole: { type: String, enum: ["author", "admin"], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true },
    visibility: { type: String, enum: ["public", "internal"], default: "public" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const eventSchema = new Schema<EventSubdoc>(
  {
    type: { type: String, required: true },
    actorRole: { type: String, enum: ["author", "admin", "system"], default: "system" },
    actorId: { type: String, default: null },
    from: { type: String, default: null },
    to: { type: String, default: null },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new Schema<TicketDoc>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    author_id: { type: String, required: true, index: true },
    book_id: { type: String, default: null },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    attachments: { type: [attachmentSchema], default: [] },

    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    categorySource: {
      type: String,
      enum: CLASSIFICATION_SOURCES,
      default: "default",
    },
    categoryConfidence: { type: Number, default: null },

    priority: { type: String, enum: PRIORITIES, required: true },
    prioritySource: {
      type: String,
      enum: CLASSIFICATION_SOURCES,
      default: "default",
    },

    aiOriginal: {
      type: {
        category: { type: String, enum: TICKET_CATEGORIES },
        priority: { type: String, enum: PRIORITIES },
      },
      default: null,
    },

    status: { type: String, enum: TICKET_STATUSES, default: "Open", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    aiDraft: {
      type: {
        body: String,
        model: String,
        generatedAt: Date,
        fallback: { type: Boolean, default: false },
      },
      default: null,
    },
    aiMeta: {
      type: {
        provider: String,
        model: String,
        tokensIn: { type: Number, default: 0 },
        tokensOut: { type: Number, default: 0 },
        latencyMs: { type: Number, default: 0 },
        fallback: { type: Boolean, default: false },
        lastRunAt: Date,
      },
      default: null,
    },

    messages: { type: [messageSchema], default: [] },
    events: { type: [eventSchema], default: [] },

    lastActivityAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

// The admin queue's default "urgency" view: unresolved first, urgent + oldest on top.
ticketSchema.index({ status: 1, priority: 1, createdAt: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ createdAt: -1 });

export const Ticket =
  (models.Ticket as Model<TicketDoc>) ??
  model<TicketDoc>("Ticket", ticketSchema);
