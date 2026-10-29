import { apiFetch, apiFetchPage, type PageMeta } from "@/lib/api-client";
import type { AdminTicketQuery, AuthorTicketQuery } from "@/shared/schemas/filters";
import type {
  CreateAdminMessageInput,
  CreateTicketInput,
  UpdateTicketInput,
} from "@/shared/schemas/ticket";
import type {
  BookDTO,
  ClassificationSummary,
  RoyaltyTotals,
  SessionUser,
  TicketDTO,
  TicketStats,
} from "@/shared/types";

/**
 * Thin, typed wrappers around the REST API.
 *
 * Components and SWR hooks call these instead of `fetch` directly, so URLs and
 * payload shapes live in exactly one place and the whole request surface is
 * greppable when reviewing API usage.
 */

/** Drops empty values so `?status=&page=1` never reaches the server. */
export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Cancels an in-flight request when SWR revalidates or the component unmounts. */
export interface FetchOptions {
  signal?: AbortSignal;
}

export type TicketPage = { items: TicketDTO[] } & PageMeta;

// --- Auth -----------------------------------------------------------------
export const getMe = () => apiFetch<{ user: SessionUser }>("/api/auth/me");

export const login = (input: { email: string; password: string }) =>
  apiFetch<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const logout = () =>
  apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });

// --- Author ---------------------------------------------------------------
export const listMyBooks = () =>
  apiFetch<{ books: BookDTO[]; totals: RoyaltyTotals }>("/api/me/books");

export const listMyTickets = (query: AuthorTicketQuery, opts?: FetchOptions) =>
  apiFetchPage<TicketDTO>(`/api/me/tickets${toQuery(query)}`, {
    signal: opts?.signal,
  });

export const getMyTicket = (id: string, opts?: FetchOptions) =>
  apiFetch<{ ticket: TicketDTO }>(
    `/api/me/tickets/${encodeURIComponent(id)}`,
    { signal: opts?.signal },
  );

export const createTicket = (input: CreateTicketInput) =>
  apiFetch<{ ticket: TicketDTO }>("/api/me/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const addAuthorMessage = (id: string, body: string) =>
  apiFetch<{ ticket: TicketDTO }>(
    `/api/me/tickets/${encodeURIComponent(id)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );

// --- Admin ----------------------------------------------------------------
export const listAdminTickets = (query: AdminTicketQuery, opts?: FetchOptions) =>
  apiFetchPage<TicketDTO>(`/api/admin/tickets${toQuery(query)}`, {
    signal: opts?.signal,
  });

export const getAdminTicket = (id: string, opts?: FetchOptions) =>
  apiFetch<{ ticket: TicketDTO }>(
    `/api/admin/tickets/${encodeURIComponent(id)}`,
    { signal: opts?.signal },
  );

export const updateAdminTicket = (id: string, input: UpdateTicketInput) =>
  apiFetch<{ ticket: TicketDTO }>(
    `/api/admin/tickets/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const addAdminMessage = (id: string, input: CreateAdminMessageInput) =>
  apiFetch<{ ticket: TicketDTO }>(
    `/api/admin/tickets/${encodeURIComponent(id)}/messages`,
    { method: "POST", body: JSON.stringify(input) },
  );

export const runAdminAi = (id: string, mode: "draft" | "classify") =>
  apiFetch<{
    ticket: TicketDTO;
    draft?: { body: string; model: string; generatedAt: string; fallback: boolean };
    classification?: ClassificationSummary;
    applied?: boolean;
  }>(`/api/admin/tickets/${encodeURIComponent(id)}/ai`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });

export const getTicketStats = () =>
  apiFetch<{ stats: TicketStats }>("/api/admin/stats");
