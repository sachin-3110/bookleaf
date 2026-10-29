import type { TicketCategory, TicketPriority } from "@/shared/constants";
import type { TicketAiContext } from "./types";

/**
 * Deterministic, dependency-free fallback.
 *
 * This is the reason the product never has a single-point-of-failure on the AI
 * provider: when the key is missing, the model errors, the response times out
 * or the output fails validation, these keyword rules and templates take over.
 * They are deliberately simple and explainable — a reviewer can read the table
 * below and predict every output.
 *
 * Output quality is intentionally "good enough": correct category, sensible
 * priority, a polite policy-grounded draft that a human will edit before
 * sending.
 */

const FIRST_NAME_STOPWORDS = new Set(["dr", "mr", "mrs", "ms", "prof"]);

function firstName(name?: string | null): string {
  const candidate =
    name
      ?.trim()
      .split(/\s+/)
      .find((part) => !FIRST_NAME_STOPWORDS.has(part.toLowerCase())) ?? "";
  return candidate || "there";
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Ordered: on a score tie, the earlier entry wins (specific beats generic). */
const CATEGORY_RULES: { category: TicketCategory; patterns: RegExp[] }[] = [
  {
    category: "Royalty & Payments",
    patterns: [
      /royalt/i,
      /payout|paid out|pay out/i,
      /payment|remuneration/i,
      /bank (account|details|transfer)/i,
      /earnings?|earned/i,
      /\bsales|proceeds|net profit|commission\b/i,
      /\bmoney\b|amount due|outstanding amount/i,
    ],
  },
  {
    category: "ISBN & Metadata Issues",
    patterns: [
      /\bisbn\b/i,
      /\bbarcode\b/i,
      /metadata/i,
      /(wrong|incorrect|duplicate|mismatch(ed)?) (isbn|book|title)/i,
      /change (the )?(title|description|author name|genre|bio)/i,
      /update (my|the) (title|description|bio|book details)/i,
    ],
  },
  {
    category: "Printing & Quality",
    patterns: [
      /print(ing|ed)? (quality|issue|error|defect)/i,
      /misprint|mis-print/i,
      /\bblurry|faded|smudg|misalign/i,
      /binding|spine|glue|pages? (falling|missing|torn)/i,
      /paper quality|print quality|\bcmyk|colour|color (inconsist|issue|quality)/i,
      /\bdefect|damaged|torn|dented\b/i,
      /reprint/i,
    ],
  },
  {
    category: "Distribution & Availability",
    patterns: [
      /amazon|flipkart|kindle|bookleaf store/i,
      /unavailable|out of stock|not in stock/i,
      /listing|listed|not showing|delisted/i,
      /distribut/i,
      /stock sync|re-?sync/i,
      /\bstore\b.*(missing|empty)/i,
    ],
  },
  {
    category: "Book Status & Production Updates",
    patterns: [
      /\bstatus\b|current stage|which stage/i,
      /production|in production/i,
      /typeset|typesetting|proofread|cover design|editing|manuscript/i,
      /\bwhen (will|is|can)\b.*\b(book|publish|live|ready)\b/i,
      /how long|timeline|eta\b/i,
      /\bdelay|delayed|stuck|waiting\b/i,
      /not published yet|publish(ed)? yet/i,
    ],
  },
];

interface ScoredCategory {
  category: TicketCategory;
  score: number;
  matched: string[];
}

/** Counts distinct pattern hits per category; ties resolved by rule order. */
function scoreCategories(text: string): ScoredCategory[] {
  return CATEGORY_RULES.map(({ category, patterns }) => {
    const matched: string[] = [];
    for (const pattern of patterns) {
      const hit = pattern.exec(text);
      if (hit) matched.push(hit[0].trim().toLowerCase());
    }
    return { category, score: matched.length, matched };
  });
}

const CRITICAL_SIGNALS = [
  /wrong isbn|incorrect isbn|duplicate isbn|isbn (mismatch|error)/i,
  /\blegal\b|copyright|plagiar|defamat|infring/i,
  /fraud|stolen|misappropriat/i,
  /bank details? (changed|compromised|hacked)/i,
  /no (royalt|payment|payout).{0,30}(at all|ever|for (over )?\d+ (months|years))/i,
];

const HIGH_SIGNALS = [
  /misprint|mis-print|blurry|damaged|defect|torn|binding/i,
  /unavailable|out of stock|delisted/i,
  /never (received|got)|not received|didn'?t receive/i,
  /overdue|pending for (months|weeks)/i,
  /\bstuck\b|no (response|update) (for|since)/i,
  /\b(months|weeks)\b/i,
];

const MEDIUM_SIGNALS = [
  /\bwhen\b|timeline|how long|eta\b/i,
  /\bstatus\b|update/i,
  /delay|delayed|waiting/i,
];

function scorePriority(text: string, category: TicketCategory): TicketPriority {
  if (CRITICAL_SIGNALS.some((p) => p.test(text))) return "Critical";
  if (HIGH_SIGNALS.some((p) => p.test(text))) return "High";

  // Category-aware defaults: some categories are inherently more sensitive.
  if (category === "ISBN & Metadata Issues") return "High";
  if (category === "Royalty & Payments") return "High";
  if (category === "Printing & Quality") return "Medium";

  if (MEDIUM_SIGNALS.some((p) => p.test(text))) return "Medium";
  return category === "General Inquiry" ? "Low" : "Medium";
}

export interface RuleClassification {
  category: TicketCategory;
  priority: TicketPriority;
  reason: string;
}

/** Keyword/regex classification + heuristic priority. Never throws. */
export function classifyByRules(input: TicketAiContext): RuleClassification {
  const text = `${input.subject}\n${input.description}`;

  const scored = scoreCategories(text).sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const category: TicketCategory =
    winner && winner.score > 0 ? winner.category : "General Inquiry";

  const priority = scorePriority(text, category);

  const reason =
    winner && winner.score > 0
      ? `Keyword match (${winner.matched.slice(0, 4).join(", ")}).`
      : "No policy keywords matched; defaulted to a general enquiry.";

  return { category, priority, reason };
}

// ---------------------------------------------------------------------------
// Draft templates
// ---------------------------------------------------------------------------

function money(value: number | null | undefined): string {
  return typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : "—";
}

function royaltyLine(input: TicketAiContext): string {
  if (!input.bookTitle) return "";
  const payout = input.lastPayoutDate
    ? `Your most recent payout was on ${input.lastPayoutDate}.`
    : "We have no payout recorded on this title yet.";
  return `For ${input.bookTitle}: ${money(input.earned)} earned in total, ${money(
    input.paid,
  )} paid out, and ${money(input.pending)} currently pending. ${payout}`;
}

type Template = (input: TicketAiContext, first: string) => string;

const TEMPLATES: Record<TicketCategory, Template> = {
  "Royalty & Payments": (input, first) => `Hi ${first},

Thank you for raising this, and I'm sorry for the worry an unpaid royalty causes. I understand that this is money you have earned, and it should not need chasing.

${royaltyLine(input)}

Royalties are calculated quarterly and paid within 45 days of the quarter ending, by bank transfer to the account linked in your dashboard. Payouts below the ₹1,000 minimum threshold roll over, so a quiet quarter can look like a missing payment when it is not.

Our team is pulling the payout record for your account now and will confirm the exact next payout date within 48 hours. If your bank details have changed recently, please update them in the dashboard so the next transfer is not delayed.

— Team BookLeaf`,

  "ISBN & Metadata Issues": (input, first) => `Hi ${first},

Thank you for reporting this, and I'm sorry you had to. An incorrect ISBN is a serious data issue on our side, not a cosmetic one, and we treat it as high priority.

We have escalated it to our production team, who will verify the ISBN record against the platform listings${
    input.bookTitle ? ` for ${input.bookTitle}` : ""
  }. Because ISBNs are registered under BookLeaf's publisher imprint, the correction has to be made by us rather than by you.

You will hear back with a confirmed resolution within 48 hours. If the wrong ISBN also appears on your printed copies, please send a photo of the copyright page so we can check the print batch at the same time.

— Team BookLeaf`,

  "Printing & Quality": (input, first) => `Hi ${first},

I'm sorry the copies${
    input.bookTitle ? ` of ${input.bookTitle}` : ""
  } arrived in this condition. That is not the standard we hold ourselves to, and I understand the disappointment of opening a box to find it.

Please send two or three photos showing the fault — the affected pages, and the spine or cover if it is a binding issue. Once our production team verifies the defect we arrange a free reprint, printed in-house and dispatched within 5–7 business days of that confirmation.

If this was a bulk author order, tell us the quantity affected so we can replace the batch rather than individual copies.

— Team BookLeaf`,

  "Distribution & Availability": (input, first) => `Hi ${first},

Thanks for flagging this, and I'm sorry ${
    input.bookTitle ? `${input.bookTitle} is` : "your title is"
  } showing as unavailable. I know how frustrating that is when you are sending readers to the link.

This is almost always a stock sync issue between our systems and the platform rather than a genuine stock-out. Our distribution team is triggering a re-sync now, and listings normally correct themselves within 24–48 hours.

If it is still showing as unavailable after that, reply here and we will raise it directly with the platform on your behalf.

— Team BookLeaf`,

  "Book Status & Production Updates": (input, first) => `Hi ${first},

Thank you for checking in, and I'm sorry for the uncertainty. I have pulled up the production record so I can give you a straight answer rather than a holding reply.

${
    input.bookStatus
      ? `The book is currently at the "${input.bookStatus}" stage.`
      : "I am confirming the current stage with our production team."
  } Authors are updated by email at every stage, and the two stages that most often cause a wait are cover design, while artwork approval is pending, and proofreading, while revisions are in progress.

Our team will send you a confirmed date for the next stage within 48 hours. If there is a stage you would like prioritised, tell us and we will look at what is possible.

— Team BookLeaf`,

  "General Inquiry": (input, first) => `Hi ${first},

Thank you for getting in touch. I have read your query and want to make sure you get a proper answer rather than a holding reply.

${
    input.bookTitle
      ? `I can see this relates to ${input.bookTitle}, so I have flagged it to the team who handle that title.`
      : "I have passed this to the right team so they can look into your account directly."
  }

If you can add a little more detail — the book involved and any order or listing reference — we will come back to you with a specific answer within 2 business days.

— Team BookLeaf`,
};

/** Category-specific template draft. Used when the model is unavailable. */
export function draftByRules(
  input: TicketAiContext,
  category: TicketCategory,
): string {
  return TEMPLATES[category](input, firstName(input.authorName));
}
