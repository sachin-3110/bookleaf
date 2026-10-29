"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  GENERAL_BOOK_LABEL,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/shared/constants";
import type { AdminTicketQuery, TicketSort } from "@/shared/schemas/filters";
import type { TicketDTO } from "@/shared/types";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PriorityChip,
  StatusChip,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { useAdminTickets } from "@/lib/hooks";

const PAGE_SIZE = 12;

const SORT_LABELS: Record<TicketSort, string> = {
  urgency: "Most urgent first",
  newest: "Newest first",
  oldest: "Oldest first",
  updated: "Recently updated",
};

const EMPTY_FILTERS: AdminTicketQuery = {
  page: 1,
  limit: PAGE_SIZE,
  sort: "urgency",
};

/**
 * Support queue.
 *
 * The default sort is `urgency` — a database-side ranking of status, then
 * priority, then age (see `SORT_STAGES` in tickets.service.ts). That ordering
 * is the product's whole point: the team should not have to scan a list to find
 * the ticket that is about to burn.
 */
export default function AdminQueuePage() {
  const [filters, setFilters] = useState<AdminTicketQuery>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useAdminTickets(filters);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = filters.page ?? 1;

  /** Any filter change resets to page 1 — page 3 of a different filter is meaningless. */
  function patch(next: Partial<AdminTicketQuery>) {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  const activeCount = [
    filters.status,
    filters.category,
    filters.priority,
    filters.assignedTo,
    filters.q,
  ].filter(Boolean).length;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patch({ q: search.trim() || undefined });
  }

  function reset() {
    setSearch("");
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin Console"
        title="Support queue"
        description={`${total} ticket${total === 1 ? "" : "s"} matching the current filters. Default order surfaces what needs attention first.`}
        action={
          <Link href="/admin/stats" className="btn btn-secondary">
            Overview
          </Link>
        }
      />

      <form onSubmit={onSearch} className="card mb-5 px-4 py-3.5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Select
            label="Status"
            value={filters.status ?? ""}
            onChange={(value) => patch({ status: enumOrUndefined<TicketStatus>(value) })}
            options={TICKET_STATUSES}
          />
          <Select
            label="Category"
            value={filters.category ?? ""}
            onChange={(value) =>
              patch({ category: enumOrUndefined<TicketCategory>(value) })
            }
            options={TICKET_CATEGORIES}
          />
          <Select
            label="Priority"
            value={filters.priority ?? ""}
            onChange={(value) =>
              patch({ priority: enumOrUndefined<TicketPriority>(value) })
            }
            options={PRIORITIES}
          />
          <Select
            label="Assignment"
            value={filters.assignedTo ?? ""}
            onChange={(value) => patch({ assignedTo: value || undefined })}
            options={[]}
            extraOptions={[
              { value: "me", label: "Assigned to me" },
              { value: "unassigned", label: "Unassigned" },
            ]}
          />
          <Select
            label="Sort"
            value={filters.sort}
            onChange={(value) => patch({ sort: value as TicketSort })}
            options={[]}
            extraOptions={Object.entries(SORT_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>

        <div className="hairline-t mt-3.5 flex flex-wrap items-center gap-2 pt-3.5">
          <input
            className="field !h-9 max-w-[340px] flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject, description or ticket ID"
            aria-label="Search tickets"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
          {activeCount > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Could not load the queue."
          }
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <LoadingRows rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          description="Try widening the filters, or clear them to see the full queue."
          action={
            activeCount > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((ticket) => (
              <li key={ticket.id}>
                <QueueRow ticket={ticket} />
              </li>
            ))}
          </ul>

          {lastPage > 1 ? (
            <div className="hairline-t mt-6 flex items-center justify-between pt-4">
              <p className="text-[12px] text-muted">
                Page {page} of {lastPage} · {total} tickets
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => patch({ page: page - 1 })}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= lastPage}
                  onClick={() => patch({ page: page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function QueueRow({ ticket }: { ticket: TicketDTO }) {
  return (
    <Link
      href={`/admin/tickets/${ticket.ticketId}`}
      className="card rise block px-5 py-4 transition-colors duration-150 hover:bg-sunken"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-faint">
              {ticket.ticketId}
            </span>
            <span className="text-[11px] text-faint">·</span>
            <span className="text-[11px] text-muted">{ticket.authorName}</span>
            <span className="text-[11px] text-faint">·</span>
            <span className="truncate text-[11px] text-muted">
              {ticket.bookTitle ?? GENERAL_BOOK_LABEL}
            </span>
          </div>
          <h2 className="mt-1.5 truncate text-[14.5px] text-ink">
            {ticket.subject}
          </h2>
          <p className="mt-1 text-[11.5px] text-muted">
            {ticket.category} · {formatRelative(ticket.lastActivityAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <PriorityChip priority={ticket.priority} />
            <StatusChip status={ticket.status} />
          </div>
          <span className="text-[11px] text-faint">
            {ticket.assignedToName
              ? `Assigned · ${ticket.assignedToName}`
              : "Unassigned"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  extraOptions = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  extraOptions?: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="label !mb-1">{label}</span>
      <select
        className="field !h-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {extraOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Empty string means "no filter" — never send `?status=` to the API. */
function enumOrUndefined<T extends string>(value: string): T | undefined {
  return value ? (value as T) : undefined;
}
