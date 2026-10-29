import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "@/shared/constants";

export interface UserDoc {
  _id: Types.ObjectId;
  role: Role;
  name: string;
  email: string;
  /** bcrypt hash — excluded from queries by default (`select: false`). */
  passwordHash: string;
  /** Links an author login to the `authors` collection (AUTH001…). Null for admins. */
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    role: { type: String, enum: ROLES, required: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    authorId: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
