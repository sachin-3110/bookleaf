import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/server/db/connect";
import { User, type UserDoc } from "@/server/models/User";
import type { SessionUser } from "@/shared/types";

/**
 * Auth data access. Returns plain data (or `null`) — never HTTP concerns —
 * so the route layer owns status codes.
 */

function toSessionUser(doc: Pick<UserDoc, "role" | "name" | "email" | "authorId"> & {
  _id: unknown;
}): SessionUser {
  return {
    id: String(doc._id),
    role: doc.role,
    name: doc.name,
    email: doc.email,
    authorId: doc.authorId ?? null,
  };
}

/**
 * Verifies credentials. Always runs a bcrypt comparison, even when the user
 * does not exist, so response timing does not reveal which emails are
 * registered.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  await connectDB();

  const doc = await User.findOne({ email: email.trim().toLowerCase() })
    .select("+passwordHash")
    .lean();

  const hash = doc?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);

  if (!doc || !ok) return null;
  return toSessionUser(doc);
}

/** Re-reads the user so `/me` reflects deletions or role changes immediately. */
export async function findUserById(id: string): Promise<SessionUser | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const doc = await User.findById(id).lean();
  if (!doc) return null;
  return toSessionUser(doc);
}

/**
 * A valid bcrypt hash of a random value, used only to equalise timing when the
 * email is unknown. Precomputed so no work happens on the happy path.
 */
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
