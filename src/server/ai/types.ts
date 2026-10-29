import type { TicketCategory, TicketPriority } from "@/shared/constants";

/**
 * Provider-agnostic AI contracts.
 *
 * The rest of the app depends on these types — never on OpenRouter specifics —
 * so swapping in Groq/OpenAI later is one new file under `providers/`.
 */

/** Everything the model is allowed to know about a ticket (never message history). */
export interface TicketAiContext {
  subject: string;
  description: string;
  bookTitle?: string | null;
  bookStatus?: string | null;
  bookGenre?: string | null;
  isbn?: string | null;
  authorName?: string | null;
  authorCity?: string | null;
  authorJoinedDate?: string | null;
  earned?: number | null;
  paid?: number | null;
  pending?: number | null;
  lastPayoutDate?: string | null;
}

/** Observability record persisted on the ticket (`aiMeta`). */
export interface AiRunMeta {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallback: boolean;
  lastRunAt: Date;
}

export type AiSource = "ai" | "rule";

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number | null;
  reason: string | null;
  source: AiSource;
  meta: AiRunMeta;
}

export interface DraftResult {
  body: string;
  source: AiSource;
  meta: AiRunMeta;
}

export interface CompletionRequest {
  system: string;
  user: string;
  /** 0 for deterministic classification, ~0.4 for prose drafting. */
  temperature: number;
  /** Ask the provider for a strict JSON object response. */
  json: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

export class AiProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}
