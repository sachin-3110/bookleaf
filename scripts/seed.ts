/**
 * Seed script — loads the exact dataset BookLeaf provided
 * (`ref/bookleaf_sample_data.json`) into MongoDB, then creates the demo
 * logins used in the README.
 *
 * Run:
 *   npm run seed          # idempotent upsert (safe to re-run)
 *   npm run seed:fresh    # wipe the collections first, then seed
 *
 * Design notes
 *  - Upserts are keyed on the **natural keys** from the source data
 *    (`author_id`, `book_id`, `users.email`), which makes re-running safe.
 *  - Money is stored as **integer rupees**, exactly as in the source JSON.
 *  - Books still in production (no publication date / MRP / royalty rate)
 *    keep their `null`s on purpose — the UI is written to render them.
 *  - A data-integrity assertion checks `royalty_paid + royalty_pending ===
 *    total_royalty_earned` and warns (rather than fails) if the source data
 *    ever drifts.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDB } from "../src/server/db/connect";
import { Author } from "../src/server/models/Author";
import { Book } from "../src/server/models/Book";
import { Counter } from "../src/server/models/Counter";
import { User } from "../src/server/models/User";

// ---------------------------------------------------------------------------
// Source data shape (mirrors ref/bookleaf_sample_data.json)
// ---------------------------------------------------------------------------
interface SeedBook {
  book_id: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SeedAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  joined_date: string | null;
  books: SeedBook[];
}

interface SeedFile {
  authors: SeedAuthor[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FRESH = process.argv.includes("--fresh");
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "bookleaf123";
const ADMIN_EMAIL = "admin@bookleaf.test";
const ADMIN_NAME = "BookLeaf Ops";
const TICKET_COUNTER = "ticketId";
/** `nextSequence` increments before returning, so seeding 1000 yields TK-1001. */
const TICKET_SEQ_START = 1000;

const DATA_PATH = path.resolve(
  process.cwd(),
  "..",
  "ref",
  "bookleaf_sample_data.json",
);

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function readSeedFile(): SeedFile {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Seed file not found at ${DATA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) as SeedFile;
}

async function main() {
  const started = Date.now();
  const data = readSeedFile();
  const expectedAuthors = data.authors.length;
  const expectedBooks = data.authors.reduce((n, a) => n + a.books.length, 0);

  await connectDB();
  log(`Connected to MongoDB (${mongoose.connection.name}).`);

  if (FRESH) {
    log("--fresh: clearing collections …");
    await Promise.all([
      Author.deleteMany({}),
      Book.deleteMany({}),
      User.deleteMany({}),
      // Tickets are user-generated; a fresh seed removes them and restarts IDs.
      mongoose.connection.collection("tickets").deleteMany({}),
      Counter.deleteMany({}),
    ]);
  }

  // --- Authors + Books -----------------------------------------------------
  let integrityWarnings = 0;

  for (const author of data.authors) {
    await Author.findOneAndUpdate(
      { author_id: author.author_id },
      {
        $set: {
          author_id: author.author_id,
          name: author.name,
          email: author.email.toLowerCase(),
          phone: author.phone,
          city: author.city,
          joined_date: author.joined_date ? new Date(author.joined_date) : null,
        },
      },
      { upsert: true },
    );

    for (const book of author.books) {
      // Integrity check: paid + pending must equal earned (holds for the seed).
      const sum = book.royalty_paid + book.royalty_pending;
      if (sum !== book.total_royalty_earned) {
        integrityWarnings++;
        log(
          `  ! ${book.book_id}: royalty_paid(${book.royalty_paid}) + ` +
            `royalty_pending(${book.royalty_pending}) = ${sum} ` +
            `!= total_royalty_earned(${book.total_royalty_earned})`,
        );
      }

      await Book.findOneAndUpdate(
        { book_id: book.book_id },
        {
          $set: {
            ...book,
            author_id: author.author_id,
            publication_date: book.publication_date
              ? new Date(book.publication_date)
              : null,
            last_royalty_payout_date: book.last_royalty_payout_date
              ? new Date(book.last_royalty_payout_date)
              : null,
          },
        },
        { upsert: true },
      );
    }
  }

  // --- Demo logins ---------------------------------------------------------
  // One admin + one login per author (email = their real email from the data).
  const adminHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $set: {
        role: "admin",
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        authorId: null,
      },
    },
    { upsert: true },
  );

  for (const author of data.authors) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await User.findOneAndUpdate(
      { email: author.email.toLowerCase() },
      {
        $set: {
          role: "author",
          name: author.name,
          email: author.email.toLowerCase(),
          passwordHash,
          authorId: author.author_id,
        },
      },
      { upsert: true },
    );
  }

  // --- Counters ------------------------------------------------------------
  // Ensure the counter exists so the very first ticket is TK-1001, matching the
  // API docs and the Postman collection. `$setOnInsert` makes this a no-op when
  // the counter is already present, so re-seeding never rewinds the sequence
  // (which would hand out duplicate ticket IDs). Only `--fresh` — which clears
  // the Counter collection above — starts the sequence over.
  const counter = await Counter.findOneAndUpdate(
    { _id: TICKET_COUNTER },
    { $setOnInsert: { seq: TICKET_SEQ_START } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  log(
    `Counter "${TICKET_COUNTER}" = ${counter?.seq} → next ticket is TK-${
      (counter?.seq ?? TICKET_SEQ_START) + 1
    }.`,
  );

  // --- Verify --------------------------------------------------------------
  const [authorCount, bookCount, userCount] = await Promise.all([
    Author.countDocuments(),
    Book.countDocuments(),
    User.countDocuments(),
  ]);

  log("");
  log("Seed summary");
  log("─────────────────────────────────────────────");
  log(`  authors : ${authorCount} (expected ${expectedAuthors})`);
  log(`  books   : ${bookCount} (expected ${expectedBooks})`);
  log(`  users   : ${userCount} (expected ${expectedAuthors + 1})`);
  log(`  integrity warnings : ${integrityWarnings}`);
  log("");
  log("Demo credentials (shared password)");
  log("─────────────────────────────────────────────");
  log(`  admin           ${ADMIN_EMAIL}   / ${DEMO_PASSWORD}`);
  log(`  author (any of) <author.email>   / ${DEMO_PASSWORD}`);
  log(`  e.g.            ${data.authors[0]?.email ?? "priya.sharma@email.com"}`);
  log("");

  if (authorCount !== expectedAuthors || bookCount !== expectedBooks) {
    throw new Error(
      `Count mismatch after seed: authors=${authorCount}/${expectedAuthors}, ` +
        `books=${bookCount}/${expectedBooks}`,
    );
  }

  log(`Done in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\nSeed failed: ${message}\n`);
  if (message.includes("MONGODB_URI")) {
    process.stderr.write(
      "Set MONGODB_URI in .env.local (Atlas free M0, or a local mongod) and retry.\n",
    );
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
