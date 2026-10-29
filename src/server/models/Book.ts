import { Schema, model, models, type Model, type Types } from "mongoose";

export interface BookDoc {
  _id: Types.ObjectId;
  book_id: string;
  author_id: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publication_date: Date | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: Date | null;
  print_partner: string | null;
  available_on: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Money is stored as integer rupees (matching the provided dataset).
 * Nulls are preserved deliberately: books still in production have no MRP,
 * royalty rate, publication date or print partner yet.
 */
const bookSchema = new Schema<BookDoc>(
  {
    book_id: { type: String, required: true, unique: true, index: true },
    author_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    isbn: { type: String, default: null },
    genre: { type: String, default: null },
    publication_date: { type: Date, default: null },
    status: { type: String, required: true },
    mrp: { type: Number, default: null },
    author_royalty_per_copy: { type: Number, default: null },
    total_copies_sold: { type: Number, default: 0 },
    total_royalty_earned: { type: Number, default: 0 },
    royalty_paid: { type: Number, default: 0 },
    royalty_pending: { type: Number, default: 0 },
    last_royalty_payout_date: { type: Date, default: null },
    print_partner: { type: String, default: null },
    available_on: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Book =
  (models.Book as Model<BookDoc>) ?? model<BookDoc>("Book", bookSchema);
