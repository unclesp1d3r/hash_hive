import bcrypt from 'bcrypt';
import { Schema, model, type Document } from 'mongoose';
import { baseSchemaOptions } from './base.schema';

export interface IUser extends Document {
  email: string;
  password_hash: string;
  name: string;
  status: 'active' | 'disabled';
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
}

const SALT_ROUNDS = 12;

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    last_login_at: {
      type: Date,
      default: null,
    },
  },
  baseSchemaOptions
);

// NOTE: unique: true on the email field already creates the necessary unique index.
// Removed redundant explicit index declaration to prevent duplicate index warnings.

// Instance method to compare password
userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- bcrypt.compare accepts string
  return await bcrypt.compare(candidatePassword, this['password_hash']);
};

// Static method to hash password
userSchema.statics['hashPassword'] = async function (password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const User = model<IUser>('User', userSchema);
