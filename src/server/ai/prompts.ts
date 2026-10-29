import { PRIORITIES, TICKET_CATEGORIES } from "@/shared/constants";
import { kbForCategory } from "./knowledge-base";
import type { TicketAiContext } from "./types";

/** Prompt builders. Kept separate so prompt changes are reviewable in isolation. */

const CATEGORY_LIST = TICKET_CATEGORIES.map((c) => `"${c}"`).join(", ");
const PRIORITY_LIST = PRIORITIES.map((p) => `"${p}"`).join(", ");

const CLASSIFY_SYSTEM = `You are BookLeaf Publishing's support-ticket triage assistant.

Classify the ticket into EXACTLY ONE category:
[${CATEGORY_LIST}]

Assign a priority from:
[${PRIORITY_LIST}]

Priority guidance:
- Critical: money missing or a payout badly overdue; wrong or duplicate ISBN; legal, defamation or data-privacy concerns.
- High: print quality defects; a book unavailable on a platform; production stalled beyond SLA; low-royalty disputes.
- Medium: timeline questions; metadata updates; routine status checks.
- Low: general how-to questions; bio or description edits; minor requests.

Return ONLY a JSON object with no surrounding prose, in exactly this shape:
{"category": "<one of the categories>", "priority": "<one of the priorities>", "confidence": <number 0-1>, "reason": "<one short sentence>"}`;

const DRAFT_SYSTEM_PREFIX = `You are a BookLeaf Publishing author-support specialist drafting a reply to an author.

Tone (non-negotiable):
- Empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before offering solutions.
- Be specific: use the actual numbers, dates and statuses you are given.
- If something is BookLeaf's fault, own it directly. No corporate deflection.
- If escalation or investigation is needed, commit to a concrete timeline.
- Always end with a clear next step for the author and/or the BookLeaf team.
- Plain, warm business English. No filler, no corporate jargon, no markdown.

Grounding rule: use ONLY the policies in the knowledge base below. If the knowledge base does not cover the issue, say you are escalating it for investigation instead of inventing policy.

Format: a plain-text email body of 90-170 words. No subject line. Sign off exactly as:
— Team BookLeaf`;

/** Caps worst-case input tokens without losing the substance of the report. */
const MAX_DESCRIPTION_CHARS = 1500;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function money(value: number | null | undefined): string {
  return typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : "unknown";
}

/** "Subject + description + the minimum context needed" — no message history. */
export function buildClassifyPrompt(input: TicketAiContext): {
  system: string;
  user: string;
} {
  const bookLine = input.bookTitle
    ? `${input.bookTitle} | status: ${input.bookStatus ?? "unknown"} | genre: ${input.bookGenre ?? "unknown"}`
    : "General / Account level (no specific book)";

  const user = [
    `Subject: ${input.subject}`,
    `Description: ${truncate(input.description, MAX_DESCRIPTION_CHARS)}`,
    "",
    `Book context: ${bookLine}`,
  ].join("\n");

  return { system: CLASSIFY_SYSTEM, user };
}

/** Draft prompt: role + tone + the category-scoped knowledge base + injected facts. */
export function buildDraftPrompt(
  input: TicketAiContext,
  category: (typeof TICKET_CATEGORIES)[number],
  priority: (typeof PRIORITIES)[number],
): { system: string; user: string } {
  const system = `${DRAFT_SYSTEM_PREFIX}\n\n# Knowledge base (${category})\n${kbForCategory(category)}`;

  const bookLine = input.bookTitle
    ? `${input.bookTitle} | status: ${input.bookStatus ?? "unknown"} | ISBN: ${input.isbn ?? "unknown"}`
    : "General / Account level (no specific book)";

  const user = [
    `AUTHOR: ${input.authorName ?? "unknown"}${input.authorCity ? ` (${input.authorCity})` : ""}${
      input.authorJoinedDate ? ` — joined ${input.authorJoinedDate}` : ""
    }`,
    `BOOK: ${bookLine}`,
    input.bookTitle
      ? `ROYALTY: earned ${money(input.earned)}, paid ${money(input.paid)}, pending ${money(
          input.pending,
        )}, last payout ${input.lastPayoutDate ?? "never"}`
      : "ROYALTY: not applicable",
    "",
    `TICKET SUBJECT: ${input.subject}`,
    `TICKET DESCRIPTION: ${truncate(input.description, MAX_DESCRIPTION_CHARS)}`,
    "",
    `CLASSIFICATION: ${category}   PRIORITY: ${priority}`,
  ].join("\n");

  return { system, user };
}
