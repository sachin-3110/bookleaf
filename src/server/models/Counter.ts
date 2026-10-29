import { Schema, model, models, type Model } from "mongoose";

/** Atomic sequence generator for readable ticket IDs (TK-1001, TK-1002, …). */
export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter =
  (models.Counter as Model<CounterDoc>) ??
  model<CounterDoc>("Counter", counterSchema);

/** Returns the next integer in a named sequence (atomic, safe under concurrency). */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc!.seq;
}
