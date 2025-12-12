import { startServer } from './index';

// Top-level entrypoint used by dev/prod start scripts.
// Keeping startup logic out of `index.ts` ensures tests can import the app without
// starting listeners as a side effect.
void startServer();
