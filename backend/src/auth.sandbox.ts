import express from 'express';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './config/auth.config';
import { logger } from './utils/logger';

const app = express();

app.set('trust proxy', true);
app.use('/auth', ExpressAuth(authConfig));

const DEFAULT_SANDBOX_PORT = 4000;
const SANDBOX_PORT = Number(process.env['AUTH_SANDBOX_PORT'] ?? DEFAULT_SANDBOX_PORT);
app.listen(SANDBOX_PORT, () => {
  logger.info({ port: SANDBOX_PORT }, 'Auth sandbox ready');
});
