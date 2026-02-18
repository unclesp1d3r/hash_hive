import { describe, expect, it } from 'bun:test';
import { validateDAG } from '../../src/lib/dag-validation';

describe('validateDAG', () => {
  it('should return valid for empty attacks array', () => {
    expect(validateDAG([])).toEqual({ valid: true });
  });

  it('should return valid for a single attack with no dependencies', () => {
    expect(validateDAG([{ dependencies: [] }])).toEqual({ valid: true });
  });

  it('should return valid for parallel attacks (no dependencies)', () => {
    const attacks = [{ dependencies: [] }, { dependencies: [] }, { dependencies: [] }];
    expect(validateDAG(attacks)).toEqual({ valid: true });
  });

  it('should return valid for a linear chain (0 → 1 → 2)', () => {
    const attacks = [{ dependencies: [] }, { dependencies: [0] }, { dependencies: [1] }];
    expect(validateDAG(attacks)).toEqual({ valid: true });
  });

  it('should return valid for diamond DAG (0 → 1, 0 → 2, 1 → 3, 2 → 3)', () => {
    const attacks = [
      { dependencies: [] },
      { dependencies: [0] },
      { dependencies: [0] },
      { dependencies: [1, 2] },
    ];
    expect(validateDAG(attacks)).toEqual({ valid: true });
  });

  it('should detect simple cycle (0 → 1 → 0)', () => {
    const attacks = [{ dependencies: [1] }, { dependencies: [0] }];
    const result = validateDAG(attacks);
    expect(result.valid).toBe(false);
    expect(result.cycle).toBeDefined();
    expect(result.cycle?.sort()).toEqual([0, 1]);
  });

  it('should detect complex cycle (0 → 1 → 2 → 0)', () => {
    const attacks = [{ dependencies: [2] }, { dependencies: [0] }, { dependencies: [1] }];
    const result = validateDAG(attacks);
    expect(result.valid).toBe(false);
    expect(result.cycle).toBeDefined();
    expect(result.cycle?.sort()).toEqual([0, 1, 2]);
  });

  it('should detect cycle in subset (0 ok, 1 → 2 → 1)', () => {
    const attacks = [{ dependencies: [] }, { dependencies: [2] }, { dependencies: [1] }];
    const result = validateDAG(attacks);
    expect(result.valid).toBe(false);
    expect(result.cycle).toBeDefined();
    expect(result.cycle?.sort()).toEqual([1, 2]);
  });

  it('should ignore out-of-range dependency indices', () => {
    const attacks = [{ dependencies: [99] }, { dependencies: [] }];
    expect(validateDAG(attacks)).toEqual({ valid: true });
  });

  it('should handle self-dependency as a cycle', () => {
    const attacks = [{ dependencies: [0] }];
    const result = validateDAG(attacks);
    expect(result.valid).toBe(false);
    expect(result.cycle).toEqual([0]);
  });
});
