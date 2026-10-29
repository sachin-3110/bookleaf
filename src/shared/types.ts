import type {
  ClassificationSource,
  Role,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "./constants";

/** The authenticated principal attached to a request by `withAuth`. */
export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  authorId: string | null;
}

export interface BookDTO {
  book_id: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

export interface AuthorDTO {
  author_id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  joined_date: string | null;
}

export interface MessageDTO {
  id: string;
  senderRole: "author" | "admin";
  senderName: string;
  body: string;
  visibility: "public" | "internal";
  createdAt: string;
}

export interface TicketEventDTO {
  id: string;
  type: string;
  actorRole: "author" | "admin" | "system";
  actorId: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
  createdAt: string;
}

export interface AiDraftDTO {
  body: string;
  model: string;
  generatedAt: string;
  fallback: boolean;
}

export interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
}

export interface TicketDTO {
  id: string;
  ticketId: string;
  author_id: string;
  authorName: string;
  book_id: string | null;
  bookTitle: string | null;
  subject: string;
  description: string;
  attachments: AttachmentMeta[];
  category: TicketCategory;
  categorySource: ClassificationSource;
  categoryConfidence: number | null;
  priority: TicketPriority;
  prioritySource: ClassificationSource;
  aiOriginal: { category: TicketCategory; priority: TicketPriority } | null;
  status: TicketStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  aiDraft: AiDraftDTO | null;
  messages: MessageDTO[];
  events: TicketEventDTO[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** Author dashboard totals — always computed on read, never stored. */
export interface RoyaltyTotals {
  earned: number;
  paid: number;
  pending: number;
}

/** What the AI (or the rules fallback) concluded about a ticket. */
export interface ClassificationSummary {
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number | null;
  reason: string | null;
  source: ClassificationSource;
}

/** Admin overview counts. */
export interface TicketStats {
  total: number;
  unassigned: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}
