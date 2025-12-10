import { Schema, model, type Document, type Types } from 'mongoose';
import { baseSchemaOptions } from './base.schema';
import type { UserRole } from '../../../shared/src/types';
import type { IUser } from './user.model';
import type { IProject } from './project.model';

export interface IProjectUser extends Document {
  user_id: Types.ObjectId | IUser;
  project_id: Types.ObjectId | IProject;
  roles: UserRole[];
  created_at: Date;
}

const projectUserSchema = new Schema<IProjectUser>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project_id: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    roles: {
      type: [String],
      required: true,
      enum: ['admin', 'operator', 'analyst', 'agent_owner'],
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

// Compound unique index on [user_id, project_id]
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
projectUserSchema.index({ user_id: 1, project_id: 1 }, { unique: true });

// Indexes on user_id and project_id separately
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
projectUserSchema.index({ user_id: 1 });
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Mongoose index direction (1 = ascending)
projectUserSchema.index({ project_id: 1 });

export const ProjectUser = model<IProjectUser>('ProjectUser', projectUserSchema);
