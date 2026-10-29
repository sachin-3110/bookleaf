"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { GENERAL_BOOK_LABEL } from "@/shared/constants";
import type { AttachmentMeta } from "@/shared/types";
import { Banner, FieldError, LoadingRows, PageHeader } from "@/components/ui";
import { ApiClientError } from "@/lib/api-client";
import { createTicket } from "@/lib/endpoints";
import { useMyBooks } from "@/lib/hooks";
import { formatNumber } from "@/lib/format";

/**
 * Submit Query.
 *
 * Nothing here asks the author to pick a category or a priority — that is the
 * AI triage's job (with a keyword fallback behind it). The author describes the
 * problem; the portal sorts it. See 05-ai-integration.md.
 *
 * `useSearchParams` is behind a Suspense boundary because the route can be
 * prerendered before the browser provides a query string.
 */
export default function NewTicketPage() {
  return (
    <Suspense fallback={<LoadingRows rows={3} />}>
      <NewTicketForm />
    </Suspense>
  );
}

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useMyBooks();

  const books = data?.books ?? [];
  const preselected = searchParams.get("book") ?? "";

  const [bookId, setBookId] = useState(preselected);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (subject.trim().length < 3) {
      next.subject = "Subject must be at least 3 characters.";
    } else if (subject.trim().length > 120) {
      next.subject = "Subject must be 120 characters or fewer.";
    }
    if (description.trim().length < 10) {
      next.description = "Please describe the issue in at least 10 characters.";
    } else if (description.trim().length > 4000) {
      next.description = "Description must be 4000 characters or fewer.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const { ticket } = await createTicket({
        book_id: bookId || null,
        subject: subject.trim(),
        description: description.trim(),
        attachments,
      });
      router.push(`/tickets/${ticket.ticketId}`);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).slice(0, 5 - attachments.length);
    setAttachments((current) =>
      [
        ...current,
        ...picked.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        })),
      ].slice(0, 5),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Author Portal"
        title="Submit a query"
        description="Tell us what is wrong. We will categorise and prioritise it automatically so it reaches the right person."
      />

      <form onSubmit={onSubmit} className="rise max-w-[62ch] space-y-5">
        <div>
          <label className="label" htmlFor="book">
            Related book
          </label>
          <select
            id="book"
            className="field"
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            disabled={isLoading}
          >
            <option value="">{GENERAL_BOOK_LABEL}</option>
            {books.map((book) => (
              <option key={book.book_id} value={book.book_id}>
                {book.title}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11.5px] text-muted">
            Leave this on “{GENERAL_BOOK_LABEL}” for anything not tied to one title.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            className="field"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Royalty statement for June is short by 12 copies"
            maxLength={140}
          />
          <FieldError>{errors.subject}</FieldError>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field min-h-[168px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Include order numbers, dates, or ISBNs if you have them — the more specific, the faster we can resolve it."
            maxLength={4200}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <FieldError>{errors.description}</FieldError>
            <span className="text-[11px] text-faint">
              {formatNumber(description.length)} / 4000
            </span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="attachments">
            Attachments <span className="text-faint">(optional, up to 5)</span>
          </label>
          <input
            id="attachments"
            type="file"
            multiple
            className="field !h-auto cursor-pointer py-2 text-[12.5px] file:mr-3 file:rounded file:border-0 file:bg-sunken file:px-2.5 file:py-1 file:text-[12px] file:text-ink"
            onChange={(event) => onPickFiles(event.target.files)}
            disabled={attachments.length >= 5}
          />
          {attachments.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 text-[12px] text-ink-soft"
                >
                  <span className="truncate">
                    {file.name}{" "}
                    <span className="text-faint">
                      ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost !h-7 !px-2"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {formError ? <Banner>{formError}</Banner> : null}

        <div className="hairline-t flex items-center justify-end gap-2 pt-5">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.back()}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit query"}
          </button>
        </div>
      </form>
    </>
  );
}
