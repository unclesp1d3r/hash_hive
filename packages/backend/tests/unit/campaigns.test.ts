import { describe, expect, test } from 'bun:test';

// Test the DAG validation logic by importing the pure cycle-detection algorithm
// Since validateCampaignDAG hits the DB, we test the core Kahn's algorithm logic directly.

/**
 * Pure function version of the cycle detection from campaigns service.
 * Takes a list of { id, dependencies } and returns whether the graph is a valid DAG.
 */
function validateDAG(nodes: Array<{ id: number; dependencies: number[] }>): {
  valid: boolean;
  error?: string | undefined;
} {
  if (nodes.length === 0) {
    return { valid: true };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<number, number>();
  const adjacency = new Map<number, number[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const node of nodes) {
    for (const depId of node.dependencies) {
      if (!nodeIds.has(depId)) {
        return { valid: false, error: `Node ${node.id} depends on non-existent node ${depId}` };
      }
      adjacency.get(depId)!.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue: number[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (processed !== nodes.length) {
    return { valid: false, error: 'Circular dependency detected among attacks' };
  }

  return { valid: true };
}

describe('DAG validation', () => {
  test('should accept an empty graph', () => {
    expect(validateDAG([])).toEqual({ valid: true });
  });

  test('should accept a single node with no dependencies', () => {
    expect(validateDAG([{ id: 1, dependencies: [] }])).toEqual({ valid: true });
  });

  test('should accept a valid linear chain', () => {
    const result = validateDAG([
      { id: 1, dependencies: [] },
      { id: 2, dependencies: [1] },
      { id: 3, dependencies: [2] },
    ]);
    expect(result.valid).toBe(true);
  });

  test('should accept a diamond dependency graph', () => {
    //   1
    //  / \
    // 2   3
    //  \ /
    //   4
    const result = validateDAG([
      { id: 1, dependencies: [] },
      { id: 2, dependencies: [1] },
      { id: 3, dependencies: [1] },
      { id: 4, dependencies: [2, 3] },
    ]);
    expect(result.valid).toBe(true);
  });

  test('should reject a direct cycle (A -> B -> A)', () => {
    const result = validateDAG([
      { id: 1, dependencies: [2] },
      { id: 2, dependencies: [1] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular dependency');
  });

  test('should reject a transitive cycle (A -> B -> C -> A)', () => {
    const result = validateDAG([
      { id: 1, dependencies: [3] },
      { id: 2, dependencies: [1] },
      { id: 3, dependencies: [2] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular dependency');
  });

  test('should reject a self-loop', () => {
    const result = validateDAG([{ id: 1, dependencies: [1] }]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular dependency');
  });

  test('should reject references to non-existent nodes', () => {
    const result = validateDAG([{ id: 1, dependencies: [99] }]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-existent');
  });

  test('should accept parallel independent nodes', () => {
    const result = validateDAG([
      { id: 1, dependencies: [] },
      { id: 2, dependencies: [] },
      { id: 3, dependencies: [] },
    ]);
    expect(result.valid).toBe(true);
  });
});
