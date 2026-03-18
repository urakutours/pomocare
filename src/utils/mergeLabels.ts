import type { LabelDefinition } from '@/types/session';

/**
 * Union-merge two label arrays by label ID.
 * For labels with the same ID, prefer the one from `incoming` (newer).
 */
export function mergeLabels(
  existing: LabelDefinition[],
  incoming: LabelDefinition[],
): LabelDefinition[] {
  const byId = new Map<string, LabelDefinition>();
  for (const l of existing) byId.set(l.id, l);
  for (const l of incoming) byId.set(l.id, l);
  return Array.from(byId.values());
}
