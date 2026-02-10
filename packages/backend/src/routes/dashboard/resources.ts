import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession } from '../../middleware/auth.js';
import {
  createHashList,
  createMaskList,
  createRuleList,
  createWordList,
  getHashItems,
  getHashListById,
  getMaskListById,
  getRuleListById,
  getWordListById,
  importHashList,
  listHashLists,
  listHashTypes,
  listMaskLists,
  listRuleLists,
  listWordLists,
  uploadHashListFile,
  uploadMaskListFile,
  uploadRuleListFile,
  uploadWordListFile,
} from '../../services/resources.js';
import type { AppEnv } from '../../types.js';

const resourceRoutes = new Hono<AppEnv>();

resourceRoutes.use('*', requireSession);

// ─── Hash Types ──────────────────────────────────────────────────────

resourceRoutes.get('/hash-types', async (c) => {
  const hashTypes = await listHashTypes();
  return c.json({ hashTypes });
});

// ─── Hash Lists ─────────────────────────────────────────────────────

resourceRoutes.get('/hash-lists', async (c) => {
  const projectId = Number(c.req.query('projectId'));
  if (!projectId || Number.isNaN(projectId)) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' } },
      400
    );
  }

  const hashLists = await listHashLists(projectId);
  return c.json({ hashLists });
});

const createHashListSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  hashTypeId: z.number().int().positive().optional(),
  source: z.string().max(50).optional(),
});

resourceRoutes.post('/hash-lists', zValidator('json', createHashListSchema), async (c) => {
  const data = c.req.valid('json');
  const hashList = await createHashList(data);
  return c.json({ hashList }, 201);
});

resourceRoutes.get('/hash-lists/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const hashList = await getHashListById(id);

  if (!hashList) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Hash list not found' } }, 404);
  }

  return c.json({ hashList });
});

resourceRoutes.post('/hash-lists/:id/upload', async (c) => {
  const id = Number(c.req.param('id'));
  const hashList = await getHashListById(id);

  if (!hashList) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Hash list not found' } }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!(file instanceof File)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'file field is required' } }, 400);
  }

  const result = await uploadHashListFile(id, file);
  return c.json(result);
});

resourceRoutes.post('/hash-lists/:id/import', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await importHashList(id);

  if (!result) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Hash list not found' } }, 404);
  }

  return c.json(result);
});

resourceRoutes.get('/hash-lists/:id/items', async (c) => {
  const id = Number(c.req.param('id'));
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
  const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;

  const result = await getHashItems(id, { limit, offset });
  return c.json(result);
});

// ─── Generic resource routes factory ────────────────────────────────

function createResourceRoutes(
  prefix: string,
  listFn: (projectId: number) => Promise<unknown[]>,
  getByIdFn: (id: number) => Promise<unknown | null>,
  createFn: (data: { projectId: number; name: string }) => Promise<unknown | null>,
  uploadFn: (id: number, file: File) => Promise<{ key: string; size: number }>
) {
  const createSchema = z.object({
    projectId: z.number().int().positive(),
    name: z.string().min(1).max(255),
  });

  resourceRoutes.get(`/${prefix}`, async (c) => {
    const projectId = Number(c.req.query('projectId'));
    if (!projectId || Number.isNaN(projectId)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' } },
        400
      );
    }

    const items = await listFn(projectId);
    return c.json({ [prefix]: items });
  });

  resourceRoutes.post(`/${prefix}`, zValidator('json', createSchema), async (c) => {
    const data = c.req.valid('json');
    const item = await createFn(data);
    return c.json({ item }, 201);
  });

  resourceRoutes.get(`/${prefix}/:id`, async (c) => {
    const id = Number(c.req.param('id'));
    const item = await getByIdFn(id);

    if (!item) {
      return c.json(
        { error: { code: 'RESOURCE_NOT_FOUND', message: `${prefix} item not found` } },
        404
      );
    }

    return c.json({ item });
  });

  resourceRoutes.post(`/${prefix}/:id/upload`, async (c) => {
    const id = Number(c.req.param('id'));
    const item = await getByIdFn(id);

    if (!item) {
      return c.json(
        { error: { code: 'RESOURCE_NOT_FOUND', message: `${prefix} item not found` } },
        404
      );
    }

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!(file instanceof File)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'file field is required' } },
        400
      );
    }

    const result = await uploadFn(id, file);
    return c.json(result);
  });
}

// ─── Wordlists ──────────────────────────────────────────────────────

createResourceRoutes(
  'wordlists',
  listWordLists,
  getWordListById,
  createWordList,
  uploadWordListFile
);

// ─── Rulelists ──────────────────────────────────────────────────────

createResourceRoutes(
  'rulelists',
  listRuleLists,
  getRuleListById,
  createRuleList,
  uploadRuleListFile
);

// ─── Masklists ──────────────────────────────────────────────────────

createResourceRoutes(
  'masklists',
  listMaskLists,
  getMaskListById,
  createMaskList,
  uploadMaskListFile
);

export { resourceRoutes };
