import type { User } from '../../../shared/src/types';
import type { IProject } from '../models/project.model';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    project?: IProject;
    id: string;
  }
}
