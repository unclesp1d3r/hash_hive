import express from 'express';
import { authRouter } from './auth.routes';

const router = express.Router();

// Mount auth routes
router.use('/auth', authRouter);

// Additional routes will be mounted here in future tasks
// router.use('/projects', projectsRouter);
// router.use('/agents', agentsRouter);
// router.use('/campaigns', campaignsRouter);
// router.use('/resources', resourcesRouter);

export { router as webRouter };
