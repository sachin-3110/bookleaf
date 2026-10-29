import { env } from "@/server/config/env";
import {
  AiProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
} from "../types";

/**
 * OpenRouter provider.
 *
 * OpenRouter exposes an **OpenAI-compatible** `/chat/completions` endpoint, so
 * this file is a thin transport: it never knows about categories, prompts or
 * tickets. Everything app-specific stays in `ai.service.ts`, which is why
 * swapping in Groq/OpenAI later is a copy of this file with a different URL.
 *
 * Model choice lives in `OPENROUTER_MODEL` — default is a `:free` model, which
 * is what keeps this assignment's AI cost at ₹0.
 */

const REQUEST_TIMEOUT_MS = 8_000;

/** Shape we depend on from the OpenAI-compatible response (everything optional). */
interface OpenRouterPayload {
  model?: string;
  choices?: { message?: { content?: string | null } | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string; code?: number | string };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function createOpenRouterProvider(): AIProvider {
  const baseUrl = env().OPENROUTER_BASE_URL.replace(/\/+$/, "");
  const model = env().OPENROUTER_MODEL;
  const apiKey = env().OPENROUTER_API_KEY;

  return {
    name: "openrouter",

    async complete(req: CompletionRequest): Promise<CompletionResponse> {
      // Caller may pass its own signal; we always enforce our own timeout too.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const onExternalAbort = () => controller.abort();
      req.signal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // OpenRouter uses these for attribution/rankings; harmless if unused.
            "HTTP-Referer": env().APP_URL,
            "X-Title": "BookLeaf Author Support Portal",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            temperature: req.temperature,
            max_tokens: req.maxTokens ?? 700,
            // Supported by the OpenAI-compatible models on OpenRouter; if a
            // model ignores it, `parseClassification` still extracts the JSON.
            ...(req.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: controller.signal,
        });

        const raw = await res.text();
        let payload: OpenRouterPayload | null = null;
        if (raw) {
          try {
            payload = JSON.parse(raw) as OpenRouterPayload;
          } catch {
            payload = null;
          }
        }

        if (!res.ok) {
          const detail = payload?.error?.message ?? raw.slice(0, 200);
          throw new AiProviderError(
            `OpenRouter responded ${res.status}: ${detail}`,
            res.status,
          );
        }

        const text = payload?.choices?.[0]?.message?.content?.trim() ?? "";
        if (!text) {
          throw new AiProviderError("OpenRouter returned an empty completion.");
        }

        return {
          text,
          tokensIn: toNumber(payload?.usage?.prompt_tokens),
          tokensOut: toNumber(payload?.usage?.completion_tokens),
          model: payload?.model ?? model,
        };
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw new AiProviderError(
            `OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms.`,
          );
        }
        throw new AiProviderError(
          err instanceof Error ? err.message : "OpenRouter request failed.",
        );
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}
