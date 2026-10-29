import { getProvider } from "@/server/ai/client";
import { buildClassifyPrompt, buildDraftPrompt } from "@/server/ai/prompts";
import { classifyByRules, draftByRules } from "@/server/ai/rulesFallback";
import { parseClassification } from "@/server/ai/schema";
import type {
  AiRunMeta,
  AiSource,
  ClassificationResult,
  DraftResult,
  TicketAiContext,
} from "@/server/ai/types";

/**
 * The AI service — the only thing the rest of the app talks to.
 *
 * Contract, and the reason this file exists at all:
 *   **These functions never throw.** Callers (ticket creation, admin detail)
 *   must not have to wrap AI in try/catch, because AI is an enhancement, not a
 *   dependency. Any failure — no key, provider error, timeout, unparseable
 *   output — degrades to the rules fallback and reports `source: "rule"`.
 *
 * Cost/latency guardrails:
 *   - an 8s timeout so a slow provider can never hold a request open;
 *   - classification is a single small JSON call (no retry — the fallback *is*
 *     the retry strategy, and retrying against a free tier invites 429s);
 *   - the one-line observability log per run is what makes the token story
 *     inspectable in production.
 */

const AI_TIMEOUT_MS = 8_000;
const CLASSIFY_MAX_TOKENS = 300;
const DRAFT_MAX_TOKENS = 700;

function logRun(params: {
  job: "classify" | "draft";
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallback: boolean;
  outcome: string;
}) {
  const flags = params.fallback ? " fallback" : "";
  console.info(
    `[ai] job=${params.job} provider=${params.provider} model=${params.model} ` +
      `in=${params.tokensIn} out=${params.tokensOut} ` +
      `latency=${params.latencyMs}ms${flags} outcome=${params.outcome}`,
  );
}

function aiMeta(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
): AiRunMeta {
  return {
    provider,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    fallback: false,
    lastRunAt: new Date(),
  };
}

function ruleMeta(): AiRunMeta {
  return {
    provider: "rules",
    model: "keyword-v1",
    tokensIn: 0,
    tokensOut: 0,
    latencyMs: 0,
    fallback: true,
    lastRunAt: new Date(),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A signal that fires after the AI timeout, or earlier if the request dies. */
function timeoutSignal(outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(AI_TIMEOUT_MS);
  return outer ? AbortSignal.any([outer, timeout]) : timeout;
}

// ---------------------------------------------------------------------------
// Job 1 + 2 — classify category and priority in one call
// ---------------------------------------------------------------------------

export async function classifyTicket(
  input: TicketAiContext,
  signal?: AbortSignal,
): Promise<ClassificationResult> {
  const provider = getProvider();

  if (provider) {
    const startedAt = Date.now();
    try {
      const { system, user } = buildClassifyPrompt(input);
      const res = await provider.complete({
        system,
        user,
        temperature: 0,
        json: true,
        maxTokens: CLASSIFY_MAX_TOKENS,
        signal: timeoutSignal(signal),
      });
      const latencyMs = Date.now() - startedAt;
      const parsed = parseClassification(res.text);

      if (parsed) {
        logRun({
          job: "classify",
          provider: provider.name,
          model: res.model,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          latencyMs,
          fallback: false,
          outcome: `${parsed.category}/${parsed.priority}`,
        });
        return {
          category: parsed.category,
          priority: parsed.priority,
          confidence: parsed.confidence,
          reason: parsed.reason,
          source: "ai",
          meta: aiMeta(provider.name, res.model, res.tokensIn, res.tokensOut, latencyMs),
        };
      }

      logRun({
        job: "classify",
        provider: provider.name,
        model: res.model,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        latencyMs,
        fallback: true,
        outcome: "unparseable-output",
      });
    } catch (err) {
      logRun({
        job: "classify",
        provider: provider.name,
        model: "unknown",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - startedAt,
        fallback: true,
        outcome: `error:${errorMessage(err).slice(0, 120)}`,
      });
    }
  }

  const rules = classifyByRules(input);
  return {
    category: rules.category,
    priority: rules.priority,
    // Confidence is an AI-only signal; `null` here keeps it honest.
    confidence: null,
    reason: rules.reason,
    source: "rule" satisfies AiSource,
    meta: ruleMeta(),
  };
}

// ---------------------------------------------------------------------------
// Job 3 — draft a grounded reply
// ---------------------------------------------------------------------------

export async function draftReply(
  input: TicketAiContext,
  category: ClassificationResult["category"],
  priority: ClassificationResult["priority"],
  signal?: AbortSignal,
): Promise<DraftResult> {
  const provider = getProvider();

  if (provider) {
    const startedAt = Date.now();
    try {
      const { system, user } = buildDraftPrompt(input, category, priority);
      const res = await provider.complete({
        system,
        user,
        // Slightly creative: this is prose, not a lookup.
        temperature: 0.4,
        json: false,
        maxTokens: DRAFT_MAX_TOKENS,
        signal: timeoutSignal(signal),
      });
      const latencyMs = Date.now() - startedAt;
      const body = res.text.trim();

      if (body.length >= 40) {
        logRun({
          job: "draft",
          provider: provider.name,
          model: res.model,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          latencyMs,
          fallback: false,
          outcome: `chars=${body.length}`,
        });
        return {
          body,
          source: "ai",
          meta: aiMeta(provider.name, res.model, res.tokensIn, res.tokensOut, latencyMs),
        };
      }

      logRun({
        job: "draft",
        provider: provider.name,
        model: res.model,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        latencyMs,
        fallback: true,
        outcome: `too-short:${body.length}`,
      });
    } catch (err) {
      logRun({
        job: "draft",
        provider: provider.name,
        model: "unknown",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - startedAt,
        fallback: true,
        outcome: `error:${errorMessage(err).slice(0, 120)}`,
      });
    }
  }

  return {
    body: draftByRules(input, category),
    source: "rule" satisfies AiSource,
    meta: ruleMeta(),
  };
}
