import { Schema, model, type Document, type Types } from 'mongoose';
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
      unique: true,
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

// Unique index on slug
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
projectSchema.index({ slug: 1 }, { unique: true });

// Index on created_by
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
projectSchema.index({ created_by: 1 });

// Pre-save hook to auto-generate slug from name if not provided
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion -- Mongoose pre hook typing
(projectSchema as any).pre('save', function (this: any, next: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Mongoose document context
  const slug = this.slug as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Mongoose document context
  const name = this.name as string | undefined;
  const hasSlug = slug !== undefined && slug !== '';
  const hasName = name !== undefined && name !== '';
  if (!hasSlug && hasName) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Mongoose document context
    this.slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

export const Project = model<IProject>('Project', projectSchema);
