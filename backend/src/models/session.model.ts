import { Schema, model, type Document, type Types } from 'mongoose';
import { baseSchemaOptions } from './base.schema';
import type { IUser } from './user.model';

export interface ISession extends Document {
  session_id: string;
  user_id: Types.ObjectId | IUser;
  data: Record<string, unknown>;
  expires_at: Date;
  created_at: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    session_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    ...baseSchemaOptions,
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  }
);

// TTL index on expires_at to automatically delete expired sessions
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending) and TTL (0 = immediate expiration)
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Index on session_id for fast lookups
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
sessionSchema.index({ session_id: 1 });

export const Session = model<ISession>('Session', sessionSchema);
