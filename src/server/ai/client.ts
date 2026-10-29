import { isAiConfigured } from "@/server/config/env";
import { createOpenRouterProvider } from "./providers/openrouter";
import type { AIProvider } from "./types";

/**
 * Provider factory.
 *
 * Returns `null` — rather than throwing — when AI is not configured
 * (`AI_ENABLED=false` or no key). Callers treat `null` as "go straight to the
 * rules fallback", which is what makes the app fully functional with AI off.
 *
 * The instance is cached per process; it holds no per-request state.
 */
let cached: AIProvider | null = null;
let resolved = false;

export function getProvider(): AIProvider | null {
  if (!resolved) {
    cached = isAiConfigured() ? createOpenRouterProvider() : null;
    resolved = true;
  }
  return cached;
}
