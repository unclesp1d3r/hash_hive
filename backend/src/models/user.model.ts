import bcrypt from 'bcrypt';
import { Schema, model, type Document } from 'mongoose';
import { baseSchemaOptions } from './base.schema';

export interface IUser extends Document {
  email: string;
  password_hash: string;
  name: string;
  status: 'active' | 'disabled';
  last_login_at?: Date | null;
  password_requires_upgrade?: boolean;
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
    password_requires_upgrade: {
      type: Boolean,
      default: false,
      select: false, // internal flag; only exposed intentionally in auth responses
    },
  },
  baseSchemaOptions
);

// NOTE: unique: true on the email field already creates the necessary unique index.
// Removed redundant explicit index declaration to prevent duplicate index warnings.

/**
 * Instance method to compare a candidate password with the stored hash.
 *
 * @param candidatePassword - The password to verify
 * @returns Promise<boolean> - true if password matches, false otherwise
 * @throws Error if password_hash is not loaded (must use .select('+password_hash') when querying)
 *
 * @example
 * ```typescript
 * const user = await User.findOne({ email }).select('+password_hash');
 * const isValid = await user.comparePassword(password);
 * ```
 */
userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-destructuring -- Mongoose document property access, cannot destructure conditional field
  const passwordHash = this['password_hash'];

  if (typeof passwordHash !== 'string') {
    throw new Error(
      "Password hash not loaded. Ensure user document is queried with .select('+password_hash')."
    );
  }

  return await bcrypt.compare(candidatePassword, passwordHash);
};

// Static method to hash password
userSchema.statics['hashPassword'] = async function (password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const User = model<IUser>('User', userSchema);
