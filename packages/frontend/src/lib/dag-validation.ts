interface AttackNode {
  dependencies: number[];
}

interface ValidationResult {
  valid: boolean;
  cycle?: number[];
}

/**
 * Validates that attacks form a valid DAG (no circular dependencies).
 * Uses Kahn's topological sort algorithm, matching the backend implementation
 * in packages/backend/src/services/campaigns.ts.
 *
 * Dependencies are index-based: attack.dependencies contains indices of
 * attacks that must complete before this attack can run.
 * An edge from dependency → dependent means "dependency must finish first."
 */
export function validateDAG(attacks: readonly AttackNode[]): ValidationResult {
  if (attacks.length === 0) {
    return { valid: true };
  }

  // Build in-degree count and adjacency list (index-based)
  const inDegree = new Map<number, number>();
  const adjacency = new Map<number, number[]>();

  for (let i = 0; i < attacks.length; i++) {
    inDegree.set(i, 0);
    adjacency.set(i, []);
  }

  for (let i = 0; i < attacks.length; i++) {
    const attack = attacks[i];
    if (!attack) continue;
    for (const depIdx of attack.dependencies) {
      if (depIdx < 0 || depIdx >= attacks.length) continue;
      adjacency.get(depIdx)?.push(i);
      inDegree.set(i, (inDegree.get(i) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: number[] = [];
  for (const [idx, degree] of inDegree) {
    if (degree === 0) {
      queue.push(idx);
    }
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    processed++;

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (processed !== attacks.length) {
    // Collect indices of nodes still in the graph (cycle participants)
    const cycle: number[] = [];
    for (const [idx, degree] of inDegree) {
      if (degree > 0) {
        cycle.push(idx);
      }
    }
    return { valid: false, cycle };
  }

  return { valid: true };
}
