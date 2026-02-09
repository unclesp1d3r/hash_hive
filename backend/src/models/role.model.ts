import { type Document, model, Schema } from 'mongoose';
import type { UserRole } from '../../../shared/src/types';
import { baseSchemaOptions } from './base.schema';

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

// NOTE: unique: true on name creates the index; removed redundant roleSchema.index to prevent duplicate warning.

export const Role = model<IRole>('Role', roleSchema);
