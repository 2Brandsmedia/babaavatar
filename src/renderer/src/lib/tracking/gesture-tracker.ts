import type { GestureName, GestureState } from '@shared/types';
import {
  createWaveState,
  detectHeartBothHands,
  detectSingleHandGesture,
  detectWave,
  type GestureCandidate,
  type HandInput,
  type WaveDetectorState,
} from './gesture-detector';

export interface GestureTrackerOptions {
  holdMs: number;
  cooldownMs: number;
  minConfidence: number;
  edgeThreshold: number;
}

interface HoldEntry {
  heldMs: number;
  startedAt: number;
  side: 'left' | 'right' | 'both';
  confidence: number;
}

export class GestureTracker {
  private readonly holds = new Map<GestureName, HoldEntry>();
  private readonly cooldowns = new Map<GestureName, number>();
  private readonly waveLeft: WaveDetectorState = createWaveState();
  private readonly waveRight: WaveDetectorState = createWaveState();
  private lastUpdate = 0;

  update(
    hands: Array<{ landmarks: { x: number; y: number; z: number; visibility?: number }[]; side: 'Left' | 'Right' }>,
    now: number,
    options: GestureTrackerOptions,
  ): GestureState[] {
    const dt = this.lastUpdate === 0 ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;

    const filtered = hands.filter((h) => !this.isAtEdge(h, options.edgeThreshold));

    const left = filtered.find((h) => h.side === 'Left') ?? null;
    const right = filtered.find((h) => h.side === 'Right') ?? null;

    const detected = new Map<GestureName, GestureCandidate>();

    const heart = detectHeartBothHands(left as HandInput | null, right as HandInput | null);
    if (heart && heart.confidence >= options.minConfidence) {
      detected.set('heart', heart);
    }

    for (const hand of filtered) {
      const candidate = detectSingleHandGesture(hand as HandInput);
      if (!candidate || candidate.confidence < options.minConfidence) continue;
      const existing = detected.get(candidate.name);
      if (!existing || existing.confidence < candidate.confidence) {
        detected.set(candidate.name, candidate);
      }
    }

    if (left) {
      const basis = detectSingleHandGesture(left as HandInput);
      if (detectWave(this.waveLeft, left as HandInput, basis, now)) {
        detected.set('wave', { name: 'wave', confidence: 0.8, side: 'left' });
      }
    } else {
      this.waveLeft.history.length = 0;
    }
    if (right) {
      const basis = detectSingleHandGesture(right as HandInput);
      if (detectWave(this.waveRight, right as HandInput, basis, now)) {
        const existing = detected.get('wave');
        if (!existing) detected.set('wave', { name: 'wave', confidence: 0.8, side: 'right' });
      }
    } else {
      this.waveRight.history.length = 0;
    }

    const states: GestureState[] = [];
    const seen = new Set<GestureName>();

    for (const [name, candidate] of detected) {
      seen.add(name);
      const existing = this.holds.get(name);
      let entry: HoldEntry;
      if (existing) {
        entry = {
          heldMs: existing.heldMs + dt,
          startedAt: existing.startedAt,
          side: candidate.side,
          confidence: candidate.confidence,
        };
      } else {
        entry = { heldMs: 0, startedAt: now, side: candidate.side, confidence: candidate.confidence };
      }
      this.holds.set(name, entry);

      const cooldownUntil = this.cooldowns.get(name) ?? 0;
      const reachedHold = entry.heldMs >= options.holdMs;
      const previouslyReached = existing ? existing.heldMs >= options.holdMs : false;
      const justTriggered = reachedHold && !previouslyReached && now >= cooldownUntil;
      if (justTriggered) {
        this.cooldowns.set(name, now + options.cooldownMs);
      }

      states.push({
        name,
        confidence: candidate.confidence,
        side: candidate.side,
        heldMs: entry.heldMs,
        justTriggered,
      });
    }

    for (const name of [...this.holds.keys()]) {
      if (!seen.has(name)) this.holds.delete(name);
    }

    return states;
  }

  private isAtEdge(
    hand: { landmarks: { x: number; y: number }[] },
    edgeThreshold: number,
  ): boolean {
    const wrist = hand.landmarks[0];
    if (!wrist) return true;
    if (edgeThreshold <= 0) return false;
    return (
      wrist.x < edgeThreshold ||
      wrist.x > 1 - edgeThreshold ||
      wrist.y < edgeThreshold ||
      wrist.y > 1 - edgeThreshold
    );
  }
}
