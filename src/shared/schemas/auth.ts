import { z } from "zod";

/**
 * Auth request schemas. Zod is the single source of truth: these drive runtime
 * validation, the inferred TypeScript types, and the OpenAPI document.
 */

// A deliberately dependency-free email check (avoids Zod-version-specific APIs).
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Email is required.")
    .max(200, "Email is too long.")
    .regex(EMAIL_RE, "Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(200, "Password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;
