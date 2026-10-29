import { z } from "zod";
import { PRIORITIES, TICKET_CATEGORIES } from "@/shared/constants";

/**
 * Validation of model output.
 *
 * We ask for JSON and then still validate it — models occasionally wrap JSON in
 * prose, return a near-miss enum, or omit a field. Anything that does not
 * conform returns `null`, which makes the caller fall back to the rules path
 * instead of persisting garbage.
 */

const rawSchema = z.object({
  category: z.coerce.string().optional(),
  priority: z.coerce.string().optional(),
  confidence: z.coerce.number().optional(),
  reason: z.coerce.string().optional(),
});

function matchEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  return allowed.find((option) => option.toLowerCase() === needle) ?? null;
}

export interface ParsedClassification {
  category: (typeof TICKET_CATEGORIES)[number];
  priority: (typeof PRIORITIES)[number];
  confidence: number | null;
  reason: string | null;
}

/** Extracts the first JSON object from a model reply, tolerating code fences. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Returns a validated classification, or `null` when the output is unusable. */
export function parseClassification(text: string): ParsedClassification | null {
  const json = extractJson(text);
  const parsed = rawSchema.safeParse(json);
  if (!parsed.success) return null;

  const category = matchEnum(parsed.data.category, TICKET_CATEGORIES);
  const priority = matchEnum(parsed.data.priority, PRIORITIES);
  if (!category || !priority) return null;

  const confidence =
    typeof parsed.data.confidence === "number" &&
    parsed.data.confidence >= 0 &&
    parsed.data.confidence <= 1
      ? parsed.data.confidence
      : null;

  return {
    category,
    priority,
    confidence,
    reason: parsed.data.reason?.trim().slice(0, 300) || null,
  };
}
