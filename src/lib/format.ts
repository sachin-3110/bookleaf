/**
 * Display formatting.
 *
 * These are intentionally used from **client** components only: they rely on
 * `Intl` output, which can differ between the Node runtime and the browser and
 * would therefore cause a hydration mismatch if rendered on the server.
 */

const EM_DASH = "—";

/** Money is stored as integer rupees — always render it as such, never as math. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return EM_DASH;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return EM_DASH;
  return value.toLocaleString("en-IN");
}

/** "20 Jun 2023" — a calendar date is a calendar date, so no time component. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

/** "2 days ago" — the useful unit for a support thread. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;

  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

/** Initials for a quiet avatar; falls back to a neutral glyph. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export { EM_DASH };
