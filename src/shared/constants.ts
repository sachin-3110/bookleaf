/**
 * Single source of truth for the enum-like values used across the app,
 * the API, the AI prompts and the UI. Keep in sync with the BookLeaf brief.
 */

export const TICKET_CATEGORIES = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

/** Lower rank = more urgent. Used to sort the admin queue "most urgent first". */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Where a classification/priority value came from. */
export const CLASSIFICATION_SOURCES = ["ai", "admin", "rule", "default"] as const;
export type ClassificationSource = (typeof CLASSIFICATION_SOURCES)[number];

export const ROLES = ["author", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** A ticket with no specific book is "General / Account Level". */
export const GENERAL_BOOK_LABEL = "General / Account Level";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SESSION_COOKIE = "bookleaf_session";
