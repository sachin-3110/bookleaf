"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { GENERAL_BOOK_LABEL, TICKET_STATUSES, type TicketStatus } from "@/shared/constants";
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
import { useMyTickets } from "@/lib/hooks";

const PAGE_SIZE = 10;

/**
 * My Tickets.
 *
 * The list polls every 10s (see `lib/hooks.ts`), so an admin reply shows up
 * without a manual refresh. Filters and paging live in component state rather
 * than the URL — for a single-author view there is nothing to share.
 */
export default function MyTicketsPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, error, isLoading, mutate } = useMyTickets({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeStatus(next: TicketStatus | "") {
    setStatus(next);
    setPage(1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Author Portal"
        title="My Tickets"
        description="Everything you have raised with the BookLeaf team, newest activity first."
        action={
          <Link href="/tickets/new" className="btn btn-primary">
            Submit a query
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <FilterChip active={status === ""} onClick={() => changeStatus("")}>
          All
        </FilterChip>
        {TICKET_STATUSES.map((value) => (
          <FilterChip
            key={value}
            active={status === value}
            onClick={() => changeStatus(value)}
          >
            {value}
          </FilterChip>
        ))}
      </div>

      {error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Could not load your tickets."
          }
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <LoadingRows rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title={status ? `No ${status.toLowerCase()} tickets` : "No tickets yet"}
          description="When something needs the team's attention — a royalty question, a printing issue, a metadata fix — raise it here and track it to resolution."
          action={
            <Link href="/tickets/new" className="btn btn-primary">
              Submit a query
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((ticket) => (
              <li key={ticket.id}>
                <TicketRow ticket={ticket} />
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
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

function TicketRow({ ticket }: { ticket: TicketDTO }) {
  const lastMessage = ticket.messages.at(-1);
  const awaitingReply = !lastMessage || lastMessage.senderRole !== "admin";
  const replies = ticket.messages.length;

  return (
    <Link
      href={`/tickets/${ticket.ticketId}`}
      className="card rise block px-5 py-4 transition-colors duration-150 hover:bg-sunken"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-faint">
              {ticket.ticketId}
            </span>
            <span className="text-[11px] text-faint">·</span>
            <span className="truncate text-[11px] text-muted">
              {ticket.bookTitle ?? GENERAL_BOOK_LABEL}
            </span>
            <span className="text-[11px] text-faint">·</span>
            <span className="text-[11px] text-muted">{ticket.category}</span>
          </div>

          <h2 className="mt-1.5 truncate text-[14.5px] text-ink">
            {ticket.subject}
          </h2>
          <p className="mt-1 line-clamp-1 text-[12.5px] text-muted">
            {ticket.description}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusChip status={ticket.status} />
          <div className="flex items-center gap-1.5">
            <PriorityChip priority={ticket.priority} />
            <span className="text-[11px] text-faint">
              {formatRelative(ticket.lastActivityAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="hairline-t mt-3.5 flex items-center justify-between pt-3">
        <span className="text-[11.5px] text-muted">
          {replies === 0
            ? "No replies yet"
            : `${replies} ${replies === 1 ? "reply" : "replies"}`}
        </span>
        {awaitingReply ? (
          <span className="text-[11.5px] text-warn-fg">Awaiting response</span>
        ) : (
          <span className="text-[11.5px] text-success-fg">Team has replied</span>
        )}
      </div>
    </Link>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors duration-150 ${
        active ? "bg-sunken text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
