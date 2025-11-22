import { QUEUE_NAMES } from '../../src/config/queue';

describe('Queue Configuration Unit Tests', () => {
  describe('QUEUE_NAMES', () => {
    it('should define all required queue names', () => {
      expect(QUEUE_NAMES.TASKS).toBe('tasks');
      expect(QUEUE_NAMES.HASH_IMPORT).toBe('hash-import');
      expect(QUEUE_NAMES.RESOURCE_PROCESSING).toBe('resource-processing');
      expect(QUEUE_NAMES.DEAD_LETTER).toBe('dead-letter');
    });

    it('should have unique queue names', () => {
      const queueNames = Object.values(QUEUE_NAMES);
      const uniqueNames = new Set(queueNames);

      expect(uniqueNames.size).toBe(queueNames.length);
    });

    it('should use kebab-case for queue names', () => {
      const kebabCaseRegex = /^[a-z]+(-[a-z]+)*$/;

      Object.values(QUEUE_NAMES).forEach((name) => {
        expect(name).toMatch(kebabCaseRegex);
      });
    });
  });
});
