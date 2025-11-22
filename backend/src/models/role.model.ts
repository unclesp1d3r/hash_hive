import { Schema, model, type Document } from 'mongoose';
import { baseSchemaOptions } from './base.schema';
import type { UserRole } from '../../../shared/src/types';

export interface IRole extends Document {
  name: UserRole;
  description: string;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['admin', 'operator', 'analyst', 'agent_owner'],
    },
    description: {
      type: String,
      required: true,
    },
    permissions: {
      type: [String],
      required: true,
      default: [],
    },
  },
  baseSchemaOptions
);

// Unique index on name
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
roleSchema.index({ name: 1 }, { unique: true });

export const Role = model<IRole>('Role', roleSchema);
