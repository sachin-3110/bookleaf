import { connectDB } from "@/server/db/connect";
import { Book, type BookDoc } from "@/server/models/Book";
import type { BookDTO, RoyaltyTotals } from "@/shared/types";

/**
 * Book data access (author-scoped).
 *
 * Two rules from the data model drive this file:
 *  - money stays in **integer rupees**, exactly as seeded;
 *  - in-production books keep their `null`s (no MRP, no publication date), and
 *    they are excluded from royalty totals — a pending estimate would be a
 *    guess, and this product does not show guesses next to real numbers.
 */

/** Calendar dates are returned as `YYYY-MM-DD` (no time, no timezone drift). */
function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toBookDTO(book: BookDoc): BookDTO {
  return {
    book_id: book.book_id,
    title: book.title,
    isbn: book.isbn ?? null,
    genre: book.genre ?? null,
    publication_date: toDateOnly(book.publication_date),
    status: book.status,
    mrp: book.mrp ?? null,
    author_royalty_per_copy: book.author_royalty_per_copy ?? null,
    total_copies_sold: book.total_copies_sold ?? 0,
    total_royalty_earned: book.total_royalty_earned ?? 0,
    royalty_paid: book.royalty_paid ?? 0,
    royalty_pending: book.royalty_pending ?? 0,
    last_royalty_payout_date: toDateOnly(book.last_royalty_payout_date),
    print_partner: book.print_partner ?? null,
    available_on: book.available_on ?? [],
  };
}

/** A book is "published" once it has a publication date. */
export function isPublished(book: BookDTO): boolean {
  return book.publication_date !== null;
}

/** Totals across published books only (in-production titles have no earnings yet). */
export function computeTotals(books: BookDTO[]): RoyaltyTotals {
  return books.filter(isPublished).reduce<RoyaltyTotals>(
    (acc, book) => ({
      earned: acc.earned + book.total_royalty_earned,
      paid: acc.paid + book.royalty_paid,
      pending: acc.pending + book.royalty_pending,
    }),
    { earned: 0, paid: 0, pending: 0 },
  );
}

export interface AuthorBooksResult {
  books: BookDTO[];
  totals: RoyaltyTotals;
}

/** Newest publications first; in-production titles (null date) sort last. */
export async function listAuthorBooks(authorId: string): Promise<AuthorBooksResult> {
  await connectDB();
  const docs = await Book.find({ author_id: authorId })
    .sort({ publication_date: -1, title: 1 })
    .lean();

  const books = (docs as BookDoc[]).map(toBookDTO);
  return { books, totals: computeTotals(books) };
}

/** Used to authorise `book_id` on ticket creation — never trust the client's claim. */
export async function findOwnedBook(
  authorId: string,
  bookId: string,
): Promise<BookDoc | null> {
  await connectDB();
  return (await Book.findOne({ book_id: bookId, author_id: authorId }).lean()) as
    | BookDoc
    | null;
}

/** Titles for the ticket form's book picker. */
export async function listAuthorBookOptions(
  authorId: string,
): Promise<{ book_id: string; title: string }[]> {
  await connectDB();
  const docs = await Book.find({ author_id: authorId })
    .select("book_id title")
    .sort({ title: 1 })
    .lean();
  return docs.map((d) => ({ book_id: d.book_id, title: d.title }));
}
