import { Schema, model, models, type Model, type Types } from "mongoose";

export interface AuthorDoc {
  _id: Types.ObjectId;
  author_id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  joined_date: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const authorSchema = new Schema<AuthorDoc>(
  {
    author_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    city: { type: String, default: null },
    joined_date: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Author =
  (models.Author as Model<AuthorDoc>) ??
  model<AuthorDoc>("Author", authorSchema);
