import { type Document, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from './base.schema';
import type { IUser } from './user.model';

export interface IProject extends Document {
  name: string;
  description?: string;
  slug: string;
  settings: {
    default_priority: number;
    max_agents: number;
  };
  created_by: Types.ObjectId | IUser;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_PRIORITY = 5;
const DEFAULT_MAX_AGENTS = 100;

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    slug: {
      type: String,
      required: true,
      unique: true, // unique field ensures index; removed explicit schema.index to avoid duplication
      lowercase: true,
    },
    settings: {
      default_priority: {
        type: Number,
        default: DEFAULT_PRIORITY,
      },
      max_agents: {
        type: Number,
        default: DEFAULT_MAX_AGENTS,
      },
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  baseSchemaOptions
);

// NOTE: unique: true on slug creates the unique index; removed redundant projectSchema.index to prevent duplicate warnings.

// Index on created_by
projectSchema.index({ created_by: 1 });

// Pre-validate hook to auto-generate slug from name if not provided
// Runs before validation so required: true on slug field can be satisfied
// biome-ignore lint/suspicious/noExplicitAny: Mongoose pre hook typing requires cast
(projectSchema as any).pre('validate', function (this: any, next: () => void) {
  const slug = this.slug as string | undefined;
  const name = this.name as string | undefined;
  const hasSlug = slug !== undefined && slug !== '';
  const hasName = name !== undefined && name !== '';
  if (!hasSlug && hasName) {
    this.slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (typeof next === 'function') {
    next();
  }
});

export const Project = model<IProject>('Project', projectSchema);
