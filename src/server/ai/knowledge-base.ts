import type { TicketCategory } from "@/shared/constants";

/**
 * BookLeaf Knowledge Base — the AI's grounding context.
 *
 * Kept verbatim from the assignment brief so prompts, drafts and docs can never
 * drift apart. It is split per category on purpose: sending only the relevant
 * section (plus the shared company + tone blocks) is the single biggest
 * system-prompt token saving (see 05-ai-integration.md §5).
 */

const COMPANY = `# Company
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: "Standard Free" (no upfront cost) and "Bestseller Breakthrough" (premium paid package with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- The in-house printing facility and warehouse are in Delhi; print partners include Repro India and Epitome Books.`;

const TONE = `# Communication tone (mandatory)
- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: include actual numbers, dates and statuses instead of vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If escalation or investigation is needed, give a clear timeline rather than an open-ended promise.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

const ROYALTY = `# Royalty policy
- 80/20 royalty split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP − printing cost − platform commission (Amazon/Flipkart) − shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. Below that, royalties roll over to the next quarter.
- Payouts are made by bank transfer to the account linked in the author's dashboard.
- A detailed, per-platform royalty breakdown is available in the author dashboard.`;

const ISBN = `# ISBN policy
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. An author wanting their own imprint must obtain the ISBN independently.
- A reported ISBN error (duplicate, or the wrong book linked) is a high-priority issue and is escalated to the production team.`;

const PRINTING = `# Printing & quality
- In-house printing handles most orders; overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For a quality issue (misprints, binding defects, colour inconsistency) BookLeaf arranges a free reprint after verification; the author may need to share photos of the defective copy.`;

const DISTRIBUTION = `# Distribution & availability
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing as unavailable usually means a stock sync issue; the team can trigger a re-sync within 24–48 hours.`;

const PRODUCTION = `# Production stages
A book moves through: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated by email at each stage.
- Delays most often happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`;

const GENERAL = `# General
- Metadata updates (title, description, bio) can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect on platforms within 3–5 business days.
- For anything not covered above, acknowledge the request, state that the team will look into it, and give a concrete timeline.`;

const BY_CATEGORY: Record<TicketCategory, string> = {
  "Royalty & Payments": ROYALTY,
  "ISBN & Metadata Issues": ISBN,
  "Printing & Quality": PRINTING,
  "Distribution & Availability": DISTRIBUTION,
  "Book Status & Production Updates": PRODUCTION,
  "General Inquiry": GENERAL,
};

/** One worked example per category — few-shot calibration for tone and specificity. */
const EXAMPLES: Record<TicketCategory, string> = {
  "Royalty & Payments": `# Calibration example
Query: "I published my book 4 months ago and still haven't received any royalty."
Good response: acknowledges the frustration, explains the quarterly cycle and the 45-day payout window, checks whether bank details are linked, gives the specific next payout date, and — if genuinely overdue — commits to escalation with a 48-hour timeline.`,
  "ISBN & Metadata Issues": `# Calibration example
Query: "My book shows a different ISBN on Amazon than on the physical copy."
Good response: treats it as a serious data issue, acknowledges that clearly, confirms immediate escalation to the production team, and commits to a 48-hour resolution timeline.`,
  "Printing & Quality": `# Calibration example
Query: "My author copies arrived with blurry images and misaligned pages."
Good response: apologises sincerely, asks for photos of the defective copies, confirms a free reprint once verified, and gives the 5–7 business day reprint timeline.`,
  "Distribution & Availability": `# Calibration example
Query: "My book is published but shows as 'Currently Unavailable' on Amazon."
Good response: explains this is typically a stock sync issue, confirms a re-sync is being triggered with the distribution team, and sets a 24–48 hour expectation.`,
  "Book Status & Production Updates": `# Calibration example
Query: "It's been 3 weeks and my book is still in typesetting. When will it be done?"
Good response: checks the real status, is honest about the cause of any delay (e.g. awaiting author approval of proofs), gives a specific updated timeline, and never blames the author.`,
  "General Inquiry": `# Calibration example
Query: "Can I update my book description on Amazon after it's live?"
Good response: confirms that metadata updates can be submitted via the dashboard or email, and that changes usually reflect on platforms within 3–5 business days.`,
};

/** The scoped knowledge block sent for a given ticket category. */
export function kbForCategory(category: TicketCategory): string {
  return [COMPANY, TONE, BY_CATEGORY[category], EXAMPLES[category]].join("\n\n");
}
