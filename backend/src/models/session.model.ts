import { Schema, model, type Document, type Types } from 'mongoose';
import { baseSchemaOptions } from './base.schema';
import type { IUser } from './user.model';

export interface ISession extends Document {
  sessionToken: string;
  userId: Types.ObjectId | IUser;
  expires: Date;
  created_at: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    sessionToken: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expires: {
      type: Date,
      required: true,
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

// TTL index on expires to automatically delete expired sessions. Field-level index flag removed to avoid duplication.
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending) and TTL (0 = immediate expiration)
sessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

// unique: true on sessionToken already creates an index; removed redundant explicit index.

export const Session = model<ISession>('Session', sessionSchema);
