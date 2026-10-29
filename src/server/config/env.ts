import { z } from "zod";

/**
 * Server-only environment access. Parsed lazily (on first use) so that
 * `next build` never crashes when env vars are absent at build time.
 */

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  /** Public base URL — used in docs/links only. */
  APP_URL: z.string().default("http://localhost:3000"),

  // --- AI (OpenRouter — an OpenAI-compatible gateway to many models) ---
  OPENROUTER_API_KEY: z.string().optional().default(""),
  /** Any OpenRouter model id; the `:free` suffix targets the free tier. */
  OPENROUTER_MODEL: z.string().default("google/gemini-2.0-flash-exp:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  AI_ENABLED: z
    .string()
    .default("true")
    .transform((v) => !["false", "0", "no", "off"].includes(v.toLowerCase())),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * True when AI is explicitly enabled **and** an OpenRouter key is configured.
 * When false, the app transparently uses the deterministic rule-based
 * fallback (keyword classification + heuristic priority + template draft),
 * so every feature keeps working — it never throws.
 */
export function isAiConfigured(): boolean {
  const e = env();
  return e.AI_ENABLED && e.OPENROUTER_API_KEY.trim().length > 0;
}
