"use client";

import Link from "next/link";
import type { BookDTO } from "@/shared/types";
import {
  BookStatusChip,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Stat,
} from "@/components/ui";
import { EM_DASH, formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useMyBooks } from "@/lib/hooks";

/**
 * My Books.
 *
 * The catalogue view: every title on the account, with the money that comes
 * with it and a link into the query form scoped to that book. In-production
 * titles keep their empty fields empty — showing "₹0 earned" next to a real
 * figure would read as a fact rather than an absence.
 */
export default function MyBooksPage() {
  const { data, error, isLoading, mutate } = useMyBooks();

  const books = data?.books ?? [];
  const totals = data?.totals ?? { earned: 0, paid: 0, pending: 0 };
  const publishedCount = books.filter((book) => book.publication_date).length;

  return (
    <>
      <PageHeader
        eyebrow="Author Portal"
        title="My Books"
        description="Your published and in-production titles, with royalties BookLeaf has recorded against each."
        action={
          <Link href="/tickets/new" className="btn btn-primary">
            Submit a query
          </Link>
        }
      />

      {error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Could not load your books."
          }
          onRetry={() => void mutate()}
        />
      ) : isLoading ? (
        <LoadingRows rows={4} />
      ) : books.length === 0 ? (
        <EmptyState
          title="No books on this account yet"
          description="Once a title is registered to you, it will appear here with its royalty summary."
        />
      ) : (
        <>
          <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              label="Royalty earned"
              value={formatMoney(totals.earned)}
              hint="Lifetime, across published titles"
            />
            <Stat label="Paid" value={formatMoney(totals.paid)} />
            <Stat
              label="Pending"
              value={formatMoney(totals.pending)}
              hint={`${publishedCount} published · ${books.length} total`}
            />
          </section>

          <ul className="space-y-3">
            {books.map((book) => (
              <li key={book.book_id}>
                <BookCard book={book} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function BookCard({ book }: { book: BookDTO }) {
  const published = book.publication_date !== null;

  return (
    <article className="card rise px-5 py-4.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] text-ink">{book.title}</h2>
          <p className="mt-1 font-mono text-[11px] text-faint">{book.book_id}</p>
        </div>
        <BookStatusChip status={book.status} />
      </div>

      <dl className="hairline-t mt-4 grid grid-cols-2 gap-x-6 gap-y-3 pt-4 sm:grid-cols-4">
        <Meta label="Genre" value={book.genre ?? EM_DASH} />
        <Meta label="ISBN" value={book.isbn ?? EM_DASH} mono />
        <Meta
          label="Published"
          value={published ? formatDate(book.publication_date) : "Not yet"}
        />
        <Meta label="Print partner" value={book.print_partner ?? EM_DASH} />
        <Meta label="MRP" value={formatMoney(book.mrp)} />
        <Meta
          label="Royalty / copy"
          value={formatMoney(book.author_royalty_per_copy)}
        />
        <Meta
          label="Copies sold"
          value={published ? formatNumber(book.total_copies_sold) : EM_DASH}
        />
        <Meta
          label="Last payout"
          value={
            book.last_royalty_payout_date
              ? formatDate(book.last_royalty_payout_date)
              : "Not yet paid"
          }
        />
      </dl>

      <div className="hairline-t mt-4 grid grid-cols-3 gap-4 pt-4">
        <Royalty label="Earned" value={published ? book.total_royalty_earned : null} />
        <Royalty label="Paid" value={published ? book.royalty_paid : null} />
        <Royalty label="Pending" value={published ? book.royalty_pending : null} />
      </div>

      <div className="hairline-t mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
        <span className="text-[11px] uppercase tracking-[0.1em] text-faint">
          Available on
        </span>
        {book.available_on.length > 0 ? (
          <span className="text-[12.5px] text-ink-soft">
            {book.available_on.join(" · ")}
          </span>
        ) : (
          <span className="text-[12.5px] text-muted">Not listed yet</span>
        )}
        <Link
          href={`/tickets/new?book=${encodeURIComponent(book.book_id)}`}
          className="btn btn-ghost ml-auto !h-7 !px-2"
        >
          Raise a query
        </Link>
      </div>

      {!published ? (
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          Still in production — royalty figures appear once the title goes live.
        </p>
      ) : null}
    </article>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.1em] text-faint">{label}</dt>
      <dd className={`mt-1 text-[12.5px] text-ink-soft ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Royalty({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className="mt-1 text-[15px] text-ink">{formatMoney(value)}</p>
    </div>
  );
}
