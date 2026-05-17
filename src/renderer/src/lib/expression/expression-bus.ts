export interface ExpressionTriggerOptions {
  durationMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  source?: 'hotkey' | 'gesture' | 'manual';
}

interface ActiveExpression {
  name: string;
  startedAt: number;
  fadeInMs: number;
  holdMs: number;
  fadeOutMs: number;
  source: 'hotkey' | 'gesture' | 'manual';
}

const DEFAULT_FADE_IN_MS = 200;
const DEFAULT_HOLD_MS = 1500;
const DEFAULT_FADE_OUT_MS = 400;

let active: ActiveExpression | null = null;

export function triggerExpression(name: string, options: ExpressionTriggerOptions = {}): void {
  const fadeInMs = options.fadeInMs ?? DEFAULT_FADE_IN_MS;
  const holdMs = options.durationMs ?? DEFAULT_HOLD_MS;
  const fadeOutMs = options.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
  active = {
    name,
    startedAt: performance.now(),
    fadeInMs,
    holdMs,
    fadeOutMs,
    source: options.source ?? 'manual',
  };
}

export function clearExpression(): void {
  active = null;
}

export function getCurrentExpression(now: number): { name: string; weight: number } | null {
  if (!active) return null;
  const elapsed = now - active.startedAt;
  const fadeOutStart = active.fadeInMs + active.holdMs;
  const totalDuration = fadeOutStart + active.fadeOutMs;

  if (elapsed >= totalDuration) {
    active = null;
    return null;
  }

  let weight: number;
  if (elapsed < active.fadeInMs) {
    weight = active.fadeInMs > 0 ? elapsed / active.fadeInMs : 1;
  } else if (elapsed < fadeOutStart) {
    weight = 1;
  } else {
    const remaining = totalDuration - elapsed;
    weight = active.fadeOutMs > 0 ? remaining / active.fadeOutMs : 0;
  }

  if (weight < 0) weight = 0;
  if (weight > 1) weight = 1;

  return { name: active.name, weight };
}

export function getActiveSource(): 'hotkey' | 'gesture' | 'manual' | null {
  return active?.source ?? null;
}

export function getActiveName(): string | null {
  return active?.name ?? null;
}
