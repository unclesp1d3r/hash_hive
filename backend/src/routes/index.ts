import express from 'express';
import { authRouter } from './auth.routes.authjs';

const router = express.Router();

// Mount auth routes (Auth.js /me endpoint)
// Note: Auth.js core routes are mounted directly in index.ts at /auth/*
router.use('/auth', authRouter);

// Additional routes will be mounted here in future tasks
// router.use('/projects', projectsRouter);
// router.use('/agents', agentsRouter);
// router.use('/campaigns', campaignsRouter);
// router.use('/resources', resourcesRouter);

export { router as webRouter };
