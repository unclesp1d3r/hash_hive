import { describe, expect, mock, test } from 'bun:test';
import type Redis from 'ioredis';

// Mock the logger
mock.module('../../../src/config/logger.js', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
}));

// Mock DB with chainable query builder
const mockInsertOnConflict = mock(() => Promise.resolve());
const mockInsertValues = mock(() => ({ onConflictDoNothing: mockInsertOnConflict }));
const mockUpdateSetWhere = mock(() => Promise.resolve());
mock.module('../../../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 1,
                fileRef: { bucket: 'hashhive', key: 'hash-lists/1/test.txt' },
                projectId: 1,
              },
            ]),
        }),
      }),
    }),
    insert: () => ({
      values: mockInsertValues,
    }),
    update: () => ({
      set: () => ({
        where: mockUpdateSetWhere,
      }),
    }),
  },
}));

const mockDownloadFile = mock(() =>
  Promise.resolve({
    Body: {
      transformToString: () =>
        Promise.resolve(
          [
            '5f4dcc3b5aa765d61d8327deb882cf99',
            'e99a18c428cb38d5f260853678922e03',
            '098f6bcd4621d373cade4e832627b4f6:test',
          ].join('\n')
        ),
    },
  })
);
mock.module('../../../src/config/storage.js', () => ({
  downloadFile: mockDownloadFile,
}));

// Mock BullMQ Worker
let capturedProcessor: ((job: any) => Promise<any>) | null = null;
mock.module('bullmq', () => ({
  Worker: class MockWorker {
    constructor(_name: string, processor: any) {
      capturedProcessor = processor;
    }
    on() {
      return this;
    }
    close() {
      return Promise.resolve();
    }
  },
  Queue: class MockQueue {
    add() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    getWaitingCount() {
      return Promise.resolve(0);
    }
    getActiveCount() {
      return Promise.resolve(0);
    }
    getFailedCount() {
      return Promise.resolve(0);
    }
    upsertJobScheduler() {
      return Promise.resolve();
    }
  },
}));

describe('Hash list parser worker', () => {
  test('processor downloads file and processes lines', async () => {
    const { createHashListParserWorker } = await import(
      '../../../src/queue/workers/hash-list-parser.js'
    );

    const fakeConnection = {} as Redis;
    createHashListParserWorker(fakeConnection);

    expect(capturedProcessor).toBeDefined();

    const fakeJob = {
      id: 'parse-1',
      data: { hashListId: 1, projectId: 1 },
      updateProgress: mock(() => Promise.resolve()),
      opts: { attempts: 3 },
      attemptsMade: 1,
    };

    const result = await capturedProcessor!(fakeJob);

    expect(mockDownloadFile).toHaveBeenCalledWith('hash-lists/1/test.txt', 'hashhive');
    expect(result.inserted).toBe(3);
  });
});
