import { beforeEach, describe, expect, mock, test } from 'bun:test';

// This file must run in isolation (own bun:test process) to avoid module cache
// poisoning from agent-api-contract.test.ts. The package.json test script runs
// it first with TASKS_TEST_ISOLATED=1, then runs the full suite where this file
// is skipped via the guard below.
const isIsolated = process.env['TASKS_TEST_ISOLATED'] === '1';

if (isIsolated) {
  // ─── DB mock ────────────────────────────────────────────────────────
  const mockSelect = mock(() => ({ from: mockFrom }));
  var mockFrom = mock(() => ({ where: mockWhere, innerJoin: mock() }));
  var mockWhere = mock(() => ({ limit: mockLimit, innerJoin: mock() }));
  var mockLimit = mock(() => Promise.resolve([]));
  var mockExecute = mock(() => Promise.resolve([]));

  mock.module('../../src/db/index.js', () => ({
    db: {
      select: mockSelect,
      execute: mockExecute,
      insert: mock(() => ({
        values: mock(() => ({ returning: mock(() => Promise.resolve([])) })),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => ({ returning: mock(() => Promise.resolve([])) })),
        })),
      })),
      transaction: mock(),
    },
  }));

  mock.module('../../src/services/events.js', () => ({
    emitCrackResult: mock(),
    emitTaskUpdate: mock(),
  }));

  mock.module('../../src/services/campaigns.js', () => ({
    updateCampaignProgress: mock(),
  }));

  const { assignNextTask } = await import('../../src/services/tasks.js');
  const { db } = await import('../../src/db/index.js');

  describe('assignNextTask', () => {
    beforeEach(() => {
      mockSelect.mockReset().mockImplementation(() => ({ from: mockFrom }));
      mockFrom.mockReset().mockImplementation(() => ({ where: mockWhere, innerJoin: mock() }));
      mockWhere.mockReset().mockImplementation(() => ({ limit: mockLimit, innerJoin: mock() }));
      mockLimit.mockReset().mockImplementation(() => Promise.resolve([]));
      mockExecute.mockReset().mockImplementation(() => Promise.resolve([]));
    });

    test('returns null when agent does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);
      const result = await assignNextTask(999);
      expect(result).toBeNull();
    });

    test('returns null when agent is not online', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: 1,
          projectId: 1,
          status: 'offline',
          capabilities: { gpu: true, hashModes: [0, 1000] },
        },
      ]);
      const result = await assignNextTask(1);
      expect(result).toBeNull();
    });

    test('returns null when no matching tasks (capabilities mismatch) via DB predicate', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: 1,
          projectId: 1,
          status: 'online',
          capabilities: { gpu: false, hashModes: [0] },
        },
      ]);
      mockExecute.mockResolvedValueOnce([]);
      const result = await assignNextTask(1);
      expect(result).toBeNull();
      expect(mockExecute).toHaveBeenCalled();
    });

    test('assigns task when agent capabilities match via DB predicate', async () => {
      const now = new Date();
      const rawDbRow = {
        id: 42,
        attack_id: 10,
        campaign_id: 5,
        agent_id: 1,
        status: 'assigned',
        work_range: { start: 0, end: 10000000, total: 10000000 },
        progress: {},
        result_stats: {},
        required_capabilities: { hashcatMode: 1000 },
        assigned_at: now,
        started_at: null,
        completed_at: null,
        failure_reason: null,
        created_at: now,
        updated_at: now,
      };
      const expectedCamelCase = {
        id: 42,
        attackId: 10,
        campaignId: 5,
        agentId: 1,
        status: 'assigned',
        workRange: { start: 0, end: 10000000, total: 10000000 },
        progress: {},
        resultStats: {},
        requiredCapabilities: { hashcatMode: 1000 },
        assignedAt: now,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      };

      mockLimit.mockResolvedValueOnce([
        {
          id: 1,
          projectId: 1,
          status: 'online',
          capabilities: { gpu: true, hashModes: [0, 1000, 3000] },
        },
      ]);
      mockExecute.mockResolvedValueOnce([rawDbRow]);

      const result = await assignNextTask(1);
      expect(result).not.toBeNull();
      expect(result).toEqual(expectedCamelCase);
      expect(mockExecute).toHaveBeenCalled();
    });

    test('uses SQL-level predicate, not app-layer filtering', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: 1,
          projectId: 1,
          status: 'online',
          capabilities: { gpu: false, hashModes: [0, 100] },
        },
      ]);
      mockExecute.mockResolvedValueOnce([]);

      await assignNextTask(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect((db as Record<string, unknown>)['transaction']).not.toHaveBeenCalled();
    });
  });
} else {
  // Skipped in full suite — already validated in isolated first-phase run.
  // Using describe.skip so bun:test doesn't report zero tests from this file.
  describe.skip('assignNextTask (skipped — runs in isolated phase)', () => {
    test.skip('see isolated run', () => {});
  });
}
