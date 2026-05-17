import type { VRM } from '@pixiv/three-vrm';

interface ColliderRecord {
  setRadius: (value: number) => void;
  originalRadius: number;
}

const records = new WeakMap<VRM, ColliderRecord[]>();

function collectRecords(vrm: VRM): ColliderRecord[] {
  const existing = records.get(vrm);
  if (existing) return existing;

  const manager = vrm.springBoneManager;
  if (!manager) {
    records.set(vrm, []);
    return [];
  }

  const list: ColliderRecord[] = [];
  for (const collider of manager.colliders) {
    const shape = collider.shape as unknown as { radius?: number };
    if (typeof shape.radius !== 'number') continue;
    const originalRadius = shape.radius;
    list.push({
      originalRadius,
      setRadius: (value: number) => {
        shape.radius = value;
      },
    });
  }
  records.set(vrm, list);
  return list;
}

export function applyColliderMultiplier(vrm: VRM, multiplier: number): void {
  const list = collectRecords(vrm);
  const clamped = Number.isFinite(multiplier) ? Math.max(0.1, Math.min(2, multiplier)) : 1;
  for (const record of list) {
    record.setRadius(record.originalRadius * clamped);
  }
}

export interface ColliderStats {
  total: number;
  median: number;
  max: number;
  oversizedCount: number;
  suggestion: 'reduce' | 'ok';
}

export function analyseColliders(vrm: VRM): ColliderStats {
  const list = collectRecords(vrm);
  const total = list.length;
  if (total === 0) {
    return { total: 0, median: 0, max: 0, oversizedCount: 0, suggestion: 'ok' };
  }
  const radii = list.map((r) => r.originalRadius).sort((a, b) => a - b);
  const middle = Math.floor(radii.length / 2);
  const median =
    radii.length % 2 === 0
      ? ((radii[middle - 1] ?? 0) + (radii[middle] ?? 0)) / 2
      : radii[middle] ?? 0;
  const max = radii[radii.length - 1] ?? 0;
  const threshold = median * 2;
  const oversizedCount = radii.filter((r) => r > threshold).length;
  const suggestion =
    oversizedCount >= 2 || (median > 0 && max > median * 3) ? 'reduce' : 'ok';
  return { total, median, max, oversizedCount, suggestion };
}

export function resetCache(vrm: VRM): void {
  records.delete(vrm);
}
