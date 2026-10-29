"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GENERAL_BOOK_LABEL } from "@/shared/constants";
import type { MessageDTO, TicketDTO } from "@/shared/types";
import {
  Banner,
  ErrorState,
  LoadingRows,
  MetaRow,
  PriorityChip,
  StatusChip,
} from "@/components/ui";
import { ApiClientError } from "@/lib/api-client";
import { addAuthorMessage } from "@/lib/endpoints";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { useMyTicket } from "@/lib/hooks";

/**
 * Ticket detail (author view).
 *
 * The thread polls, so a reply lands here without a refresh. Composing a new
 * message after the ticket was Resolved or Closed reopens it — the server
 * records that as an explicit `reopened` event rather than silently flipping
 * the status.
 */
export default function AuthorTicketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data, error, isLoading, mutate } = useMyTicket(id);

  const ticket = data?.ticket;

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorState
          message={
            error instanceof Error ? error.message : "Could not load this ticket."
          }
          onRetry={() => void mutate()}
        />
      </>
    );
  }

  if (isLoading || !ticket) {
    return (
      <>
        <BackLink />
        <LoadingRows rows={4} />
      </>
    );
  }

  return (
    <>
      <BackLink />

      <header className="rise mb-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-faint">{ticket.ticketId}</span>
          <StatusChip status={ticket.status} />
          <PriorityChip priority={ticket.priority} />
        </div>
        <h1 className="font-display mt-3 text-[26px] text-ink">{ticket.subject}</h1>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-6">
          <section className="card px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Your query
            </p>
            <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 ? (
              <ul className="hairline-t mt-4 space-y-1 pt-3">
                {ticket.attachments.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="text-[12px] text-muted">
                    {file.name}{" "}
                    <span className="text-faint">
                      ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="hairline-t mt-4 pt-3 text-[11.5px] text-faint">
              Raised {formatDateTime(ticket.createdAt)}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[10px] uppercase tracking-[0.14em] text-faint">
              Conversation
            </h2>
            {ticket.messages.length === 0 ? (
              <p className="card px-5 py-6 text-center text-[12.5px] text-muted">
                No replies yet. The team has been notified — you will see their
                response here.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {ticket.messages.map((message) => (
                  <li key={message.id}>
                    <MessageBubble message={message} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Composer id={id} onSent={() => void mutate()} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card px-4 py-3">
            <dl className="divide-y divide-line">
              <MetaRow label="Category">{ticket.category}</MetaRow>
              <MetaRow label="Priority">{ticket.priority}</MetaRow>
              <MetaRow label="Book">
                {ticket.bookTitle ?? GENERAL_BOOK_LABEL}
              </MetaRow>
              <MetaRow label="Opened">{formatRelative(ticket.createdAt)}</MetaRow>
              <MetaRow label="Activity">
                {formatRelative(ticket.lastActivityAt)}
              </MetaRow>
            </dl>
          </div>

          <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
            Category and priority are set automatically when you submit and may be
            adjusted by the team.
          </p>
        </aside>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/tickets"
      className="mb-4 inline-block text-[12px] text-muted transition-colors duration-150 hover:text-ink"
    >
      ← All tickets
    </Link>
  );
}

function MessageBubble({ message }: { message: MessageDTO }) {
  const fromTeam = message.senderRole === "admin";
  return (
    <article
      className={`card px-5 py-4 ${fromTeam ? "" : "bg-sunken"}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium ${
            fromTeam
              ? "bg-info-bg text-info-fg"
              : "bg-neutral-bg text-neutral-fg"
          }`}
        >
          {initials(message.senderName)}
        </span>
        <span className="text-[12.5px] text-ink">{message.senderName}</span>
        <span className="text-[11px] text-faint">
          {fromTeam ? "BookLeaf team" : "You"}
        </span>
        <span className="ml-auto text-[11px] text-faint">
          {formatRelative(message.createdAt)}
        </span>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
        {message.body}
      </p>
    </article>
  );
}

function Composer({ id, onSent }: { id: string; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addAuthorMessage(id, body.trim());
      setBody("");
      onSent();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not send your message.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card px-5 py-4">
      <label className="label" htmlFor="reply">
        Add a follow-up
      </label>
      <textarea
        id="reply"
        className="field min-h-[96px]"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add anything that helps — a screenshot description, an order ID, a corrected ISBN."
        maxLength={4000}
      />
      {error ? (
        <div className="mt-2.5">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-faint">
          Replying to a resolved ticket will reopen it.
        </p>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !body.trim()}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
