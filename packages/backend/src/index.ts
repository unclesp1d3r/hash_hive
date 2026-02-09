import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: Number(process.env['PORT']) || 4000,
  fetch: app.fetch,
};
