"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  getAdminTicket,
  getMyTicket,
  getTicketStats,
  listAdminTickets,
  listMyBooks,
  listMyTickets,
} from "@/lib/endpoints";
import type { AdminTicketQuery, AuthorTicketQuery } from "@/shared/schemas/filters";

/**
 * Data hooks.
 *
 * "Near real-time" here means **polling**, not sockets: a 10s
 * `refreshInterval` on the list and detail screens. The trade-off is chosen
 * deliberately — polling needs no extra infrastructure, works on serverless,
 * and degrades to plain HTTP. See 06-feature-decisions.md.
 */

export const POLL_INTERVAL_MS = 10_000;

const polling: SWRConfiguration = {
  refreshInterval: POLL_INTERVAL_MS,
  revalidateOnFocus: true,
  // Keeps the previous page on screen while a poll is in flight — no flicker.
  keepPreviousData: true,
};

export function useMyBooks() {
  return useSWR("me/books", () => listMyBooks(), polling);
}

export function useMyTickets(query: AuthorTicketQuery) {
  return useSWR(["me/tickets", query], () => listMyTickets(query), polling);
}

export function useMyTicket(id: string) {
  return useSWR(["me/ticket", id], () => getMyTicket(id), polling);
}

export function useAdminTickets(query: AdminTicketQuery) {
  return useSWR(["admin/tickets", query], () => listAdminTickets(query), polling);
}

export function useAdminTicket(id: string) {
  return useSWR(["admin/ticket", id], () => getAdminTicket(id), polling);
}

export function useTicketStats() {
  return useSWR("admin/stats", () => getTicketStats(), polling);
}
