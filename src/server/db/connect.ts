import mongoose from "mongoose";
import { env } from "@/server/config/env";

/**
 * Cached Mongoose connection.
 *
 * In serverless environments (Vercel) each invocation may reuse a warm
 * container, so we cache the connection on `globalThis` to avoid opening a
 * new pool on every request (which would exhaust the Atlas connection limit).
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  __bookleafMongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose.__bookleafMongoose ?? { conn: null, promise: null };

globalForMongoose.__bookleafMongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(env().MONGODB_URI, {
      // Fail fast instead of buffering forever when the DB is unreachable.
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
