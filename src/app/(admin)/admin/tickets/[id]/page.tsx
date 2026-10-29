"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  GENERAL_BOOK_LABEL,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/shared/constants";
import type { ClassificationSummary, MessageDTO, TicketDTO } from "@/shared/types";
import {
  Banner,
  ErrorState,
  LoadingRows,
  MetaRow,
  PriorityChip,
  StatusChip,
} from "@/components/ui";
import { ApiClientError } from "@/lib/api-client";
import { addAdminMessage, runAdminAi, updateAdminTicket } from "@/lib/endpoints";
import { formatDateTime, formatRelative, initials } from "@/lib/format";
import { useAdminTicket } from "@/lib/hooks";

const EVENT_LABELS: Record<string, string> = {
  created: "Ticket created",
  classified: "Auto-classified",
  status_changed: "Status changed",
  category_overridden: "Category overridden",
  priority_overridden: "Priority overridden",
  assigned: "Assignment changed",
  reply_sent: "Reply sent",
  note_added: "Internal note added",
  reopened: "Reopened",
  ai_draft_regenerated: "AI draft regenerated",
};

/**
 * Ticket detail (admin view).
 *
 * Three jobs on one screen, in priority order:
 *  1. understand the ticket — original query + full thread, internal notes included;
 *  2. let the AI do the first pass — classification and a draft reply, both
 *     inspectable and both regenerable;
 *  3. let a human override anything — every override writes an audit event, and
 *     the AI's original verdict is preserved in `aiOriginal` so the queue can
 *     always show where automation and judgement diverged.
 */
export default function AdminTicketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data, error, isLoading, mutate } = useAdminTicket(id);

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [replyBody, setReplyBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");

  const ticket = data?.ticket;

  async function run(
    key: string,
    action: () => Promise<unknown>,
    successMessage?: string,
  ) {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      await mutate();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !replyBody.trim()) return;
    const isInternal = visibility === "internal";
    await run(
      "reply",
      () => addAdminMessage(ticket.ticketId, { body: replyBody.trim(), visibility }),
      isInternal ? "Internal note added." : "Reply sent to the author.",
    );
    setReplyBody("");
  }

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
        <LoadingRows rows={5} />
      </>
    );
  }

  const closed = ticket.status === "Closed";

  /**
   * Re-running classification never clobbers a human decision — the server
   * reports `applied: false` when an admin had already overridden the category
   * or priority, and we say so rather than pretending something changed.
   */
  async function rerunClassification(ticketId: string) {
    setBusy("classify");
    setActionError(null);
    setNotice(null);
    try {
      const result = await runAdminAi(ticketId, "classify");
      await mutate();
      setNotice(
        result.applied
          ? `Re-classified as ${result.classification?.category ?? "—"} · ${result.classification?.priority ?? "—"} via ${result.classification?.source ?? "ai"}.`
          : "An admin override is in place — the AI result was recorded but not applied.",
      );
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <BackLink />

      <header className="rise mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] text-faint">
              {ticket.ticketId}
            </span>
            <StatusChip status={ticket.status} />
            <PriorityChip priority={ticket.priority} />
            <span className="text-[11px] text-muted">{ticket.category}</span>
          </div>
          <h1 className="font-display mt-3 text-[26px] text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-2 text-[12.5px] text-muted">
            {ticket.authorName} · {ticket.bookTitle ?? GENERAL_BOOK_LABEL} · raised{" "}
            {formatRelative(ticket.createdAt)}
          </p>
        </div>
        <div className="text-right text-[12px] text-muted">
          <p>{ticket.assignedToName ? `Assigned to ${ticket.assignedToName}` : "Unassigned"}</p>
          <p className="mt-0.5 text-faint">
            Last activity {formatRelative(ticket.lastActivityAt)}
          </p>
        </div>
      </header>

      {notice ? (
        <div className="mb-4 rounded-md bg-success-bg px-3 py-2 text-[12px] text-success-fg">
          {notice}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4">
          <Banner>{actionError}</Banner>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="card px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Original query
            </p>
            <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 ? (
              <ul className="hairline-t mt-4 space-y-1 pt-3">
                {ticket.attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="text-[12px] text-muted"
                  >
                    {file.name}{" "}
                    <span className="text-faint">
                      ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="hairline-t mt-4 pt-3 text-[11.5px] text-faint">
              Received {formatDateTime(ticket.createdAt)}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[10px] uppercase tracking-[0.14em] text-faint">
              Conversation
            </h2>
            {ticket.messages.length === 0 ? (
              <p className="card px-5 py-6 text-center text-[12.5px] text-muted">
                No messages yet. Use the box below to reply, or leave an internal
                note for the team.
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

          <form onSubmit={sendReply} className="card px-5 py-4">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <label className="label !mb-0" htmlFor="reply">
                Respond
              </label>
              <div className="flex rounded-md border border-line-strong p-0.5">
                <VisibilityTab
                  active={visibility === "public"}
                  onClick={() => setVisibility("public")}
                >
                  Public reply
                </VisibilityTab>
                <VisibilityTab
                  active={visibility === "internal"}
                  onClick={() => setVisibility("internal")}
                >
                  Internal note
                </VisibilityTab>
              </div>
            </div>
            <textarea
              id="reply"
              className={`field min-h-[120px] ${visibility === "internal" ? "bg-warn-bg/40" : ""}`}
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder={
                visibility === "internal"
                  ? "Note for the team — the author will not see this."
                  : "Reply to the author…"
              }
              maxLength={5000}
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-faint">
                {visibility === "internal"
                  ? "Internal notes are never shown in the author portal."
                  : "Public replies are visible to the author and mark the ticket as replied."}
              </p>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy === "reply" || !replyBody.trim()}
              >
                {busy === "reply" ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <AiPanel
            ticket={ticket}
            busy={busy}
            onClassify={() => void rerunClassification(ticket.ticketId)}
            onRun={(key, action, message) => void run(key, action, message)}
            onUseDraft={(body) => {
              setReplyBody(body);
              setVisibility("public");
              setNotice("Draft copied into the reply box — review before sending.");
            }}
          />

          <section className="card px-4 py-3.5">
            <h2 className="mb-3 text-[10px] uppercase tracking-[0.14em] text-faint">
              Triage
            </h2>

            <div className="space-y-3">
              <label className="block">
                <span className="label !mb-1">Status</span>
                <select
                  className="field !h-9"
                  value={ticket.status}
                  disabled={closed || busy !== null}
                  onChange={(event) =>
                    void run(
                      "status",
                      () =>
                        updateAdminTicket(ticket.ticketId, {
                          status: event.target.value as TicketStatus,
                        }),
                      "Status updated.",
                    )
                  }
                >
                  {TICKET_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              {closed ? (
                <div className="rounded-md bg-neutral-bg px-3 py-2.5">
                  <p className="text-[11.5px] leading-relaxed text-neutral-fg">
                    Closed is terminal. Reopening is an explicit action.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary mt-2 w-full"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        "status",
                        () =>
                          updateAdminTicket(ticket.ticketId, {
                            status: "Open",
                            reopen: true,
                          }),
                        "Ticket reopened.",
                      )
                    }
                  >
                    Reopen ticket
                  </button>
                </div>
              ) : null}

              <label className="block">
                <span className="label !mb-1">Category</span>
                <select
                  className="field !h-9"
                  value={ticket.category}
                  disabled={busy !== null}
                  onChange={(event) =>
                    void run(
                      "category",
                      () =>
                        updateAdminTicket(ticket.ticketId, {
                          category: event.target.value as TicketCategory,
                        }),
                      "Category updated.",
                    )
                  }
                >
                  {TICKET_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label !mb-1">Priority</span>
                <select
                  className="field !h-9"
                  value={ticket.priority}
                  disabled={busy !== null}
                  onChange={(event) =>
                    void run(
                      "priority",
                      () =>
                        updateAdminTicket(ticket.ticketId, {
                          priority: event.target.value as TicketPriority,
                        }),
                      "Priority updated.",
                    )
                  }
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <div className="hairline-t flex gap-2 pt-3">
                {ticket.assignedToName ? (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        "assign",
                        () => updateAdminTicket(ticket.ticketId, { assignedTo: null }),
                        "Ticket unassigned.",
                      )
                    }
                  >
                    Unassign
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        "assign",
                        () => updateAdminTicket(ticket.ticketId, { assignSelf: true }),
                        "Assigned to you.",
                      )
                    }
                  >
                    Assign to me
                  </button>
                )}
              </div>
            </div>

            <dl className="hairline-t mt-4 divide-y divide-line pt-1">
              <MetaRow label="Book">
                {ticket.bookTitle ?? GENERAL_BOOK_LABEL}
              </MetaRow>
              <MetaRow label="Updated">{formatRelative(ticket.updatedAt)}</MetaRow>
            </dl>
          </section>

          <section className="card px-4 py-3.5">
            <h2 className="mb-3 text-[10px] uppercase tracking-[0.14em] text-faint">
              Activity
            </h2>
            <ol className="space-y-3">
              {[...ticket.events].reverse().map((event) => (
                <li key={event.id} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
                  <div className="min-w-0">
                    <p className="text-[12px] text-ink-soft">
                      {EVENT_LABELS[event.type] ?? event.type}
                      {event.from && event.to ? (
                        <span className="text-muted">
                          {" "}
                          · {event.from} → {event.to}
                        </span>
                      ) : null}
                    </p>
                    {event.note ? (
                      <p className="text-[11.5px] text-muted">{event.note}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-faint">
                      {formatRelative(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

// --- AI panel -------------------------------------------------------------

function AiPanel({
  ticket,
  busy,
  onClassify,
  onRun,
  onUseDraft,
}: {
  ticket: TicketDTO;
  busy: string | null;
  onClassify: () => void;
  onRun: (
    key: string,
    action: () => Promise<unknown>,
    message?: string,
  ) => void;
  onUseDraft: (body: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const draft = ticket.aiDraft;

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.14em] text-faint">
          AI assistant
        </h2>
        {draft?.fallback ? (
          <span className="chip bg-neutral-bg text-neutral-fg">Rules</span>
        ) : null}
      </div>

      <dl className="divide-y divide-line">
        <MetaRow label="Category">{ticket.category}</MetaRow>
        <MetaRow label="Priority">{ticket.priority}</MetaRow>
        <MetaRow label="Set by">
          <SourceLabel source={ticket.categorySource} />
          {ticket.categorySource !== ticket.prioritySource ? (
            <>
              {" / "}
              <SourceLabel source={ticket.prioritySource} />
            </>
          ) : null}
        </MetaRow>
        {ticket.categoryConfidence !== null ? (
          <MetaRow label="Confidence">
            {confidenceLabel(ticket.categoryConfidence)}
          </MetaRow>
        ) : null}
        {ticket.aiOriginal ? (
          <MetaRow label="AI originally said">
            {ticket.aiOriginal.category} · {ticket.aiOriginal.priority}
          </MetaRow>
        ) : null}
      </dl>

      <button
        type="button"
        className="btn btn-secondary mt-3 w-full"
        disabled={busy !== null}
        onClick={onClassify}
      >
        {busy === "classify" ? "Re-running…" : "Re-run classification"}
      </button>

      <div className="hairline-t mt-4 pt-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-faint">
            Suggested reply
          </h3>
          {draft ? (
            <span className="text-[10.5px] text-faint">
              {formatRelative(draft.generatedAt)}
            </span>
          ) : null}
        </div>

        {draft ? (
          <>
            <p className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-md bg-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              {draft.body}
            </p>
            <p className="mt-2 font-mono text-[10.5px] text-faint">{draft.model}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void copyDraft()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onUseDraft(draft.body)}
              >
                Use as reply
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() =>
                  onRun(
                    "draft",
                    () => runAdminAi(ticket.ticketId, "draft"),
                    "New draft generated.",
                  )
                }
              >
                {busy === "draft" ? "Generating…" : "Regenerate"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary w-full"
            disabled={busy !== null}
            onClick={() =>
              onRun(
                "draft",
                () => runAdminAi(ticket.ticketId, "draft"),
                "Draft generated.",
              )
            }
          >
            {busy === "draft" ? "Generating…" : "Generate draft reply"}
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Drafts are suggestions. Nothing is ever sent without an admin pressing
        Send.
      </p>
    </section>
  );
}

function SourceLabel({ source }: { source: ClassificationSummary["source"] }) {
  const label =
    source === "ai"
      ? "AI"
      : source === "admin"
        ? "Admin override"
        : source === "rule"
          ? "Keyword rules"
          : "Default";
  return <span className="text-ink-soft">{label}</span>;
}

function confidenceLabel(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

// --- Small pieces ---------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/admin"
      className="mb-4 inline-block text-[12px] text-muted transition-colors duration-150 hover:text-ink"
    >
      ← Back to queue
    </Link>
  );
}

function VisibilityTab({
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
      className={`rounded px-2.5 py-1 text-[11.5px] transition-colors duration-150 ${
        active ? "bg-ink text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MessageBubble({ message }: { message: MessageDTO }) {
  const internal = message.visibility === "internal";
  const fromTeam = message.senderRole === "admin";

  return (
    <article
      className={`card px-5 py-4 ${internal ? "bg-warn-bg/50" : fromTeam ? "" : "bg-sunken"}`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium ${
            internal
              ? "bg-warn-bg text-warn-fg"
              : fromTeam
                ? "bg-info-bg text-info-fg"
                : "bg-neutral-bg text-neutral-fg"
          }`}
        >
          {initials(message.senderName)}
        </span>
        <span className="text-[12.5px] text-ink">{message.senderName}</span>
        <span className="text-[11px] text-faint">{fromTeam ? "Team" : "Author"}</span>
        {internal ? (
          <span className="chip bg-warn-bg text-warn-fg">Internal</span>
        ) : null}
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
