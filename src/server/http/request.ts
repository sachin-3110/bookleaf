import type { NextRequest } from "next/server";
import { ApiError } from "./ApiError";

/** Safely parses a JSON request body; empty bodies become `{}`. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    throw ApiError.badRequest("The request body must be valid JSON.");
  }
}

/** Flattens the query string into a plain object for Zod validation. */
export function parseQuery(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Best-effort client identifier for rate limiting. */
export function clientKey(req: NextRequest, suffix?: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}
