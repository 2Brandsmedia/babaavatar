import type { GestureName } from '@shared/types';
import {
  HAND_INDEX,
  clamp01,
  distance,
  fingerState,
  handCenter,
  handSize,
  thumbExtended,
  thumbsUpOrientation,
  type HandInput,
  type HandLandmark,
} from './gesture-math';

export interface GestureCandidate {
  name: GestureName;
  confidence: number;
  side: 'left' | 'right' | 'both';
}

export function detectSingleHandGesture(hand: HandInput): GestureCandidate | null {
  const lm = hand.landmarks;
  if (lm.length < 21) return null;
  const sideOut = hand.side === 'Left' ? 'left' : 'right';

  const index = fingerState(
    lm,
    HAND_INDEX.INDEX_MCP,
    HAND_INDEX.INDEX_PIP,
    HAND_INDEX.INDEX_DIP,
    HAND_INDEX.INDEX_TIP,
  );
  const middle = fingerState(
    lm,
    HAND_INDEX.MIDDLE_MCP,
    HAND_INDEX.MIDDLE_PIP,
    HAND_INDEX.MIDDLE_DIP,
    HAND_INDEX.MIDDLE_TIP,
  );
  const ring = fingerState(
    lm,
    HAND_INDEX.RING_MCP,
    HAND_INDEX.RING_PIP,
    HAND_INDEX.RING_DIP,
    HAND_INDEX.RING_TIP,
  );
  const pinky = fingerState(
    lm,
    HAND_INDEX.PINKY_MCP,
    HAND_INDEX.PINKY_PIP,
    HAND_INDEX.PINKY_DIP,
    HAND_INDEX.PINKY_TIP,
  );
  const thumbOut = thumbExtended(lm);

  const indexTip = lm[HAND_INDEX.INDEX_TIP];
  const thumbTip = lm[HAND_INDEX.THUMB_TIP];
  const size = handSize(lm);

  if (thumbOut && thumbsUpOrientation(lm) && index.bent && middle.bent && ring.bent && pinky.bent) {
    return { name: 'thumbsUp', confidence: 0.9, side: sideOut };
  }

  if (!thumbOut && index.bent && middle.bent && ring.bent && pinky.bent) {
    return { name: 'fist', confidence: 0.85, side: sideOut };
  }

  if (index.straight && middle.straight && ring.bent && pinky.bent) {
    const conf = 0.5 + (index.straightness + middle.straightness) * 0.25;
    return { name: 'peace', confidence: clamp01(conf), side: sideOut };
  }

  if (index.straight && middle.bent && ring.bent && pinky.bent) {
    return { name: 'pointing', confidence: 0.85, side: sideOut };
  }

  if (indexTip && thumbTip) {
    const pinchDist = distance(indexTip, thumbTip);
    if (pinchDist < size * 0.4 && middle.straight && ring.straight && pinky.straight) {
      return { name: 'ok', confidence: 0.85, side: sideOut };
    }
  }

  if (thumbOut && index.straight && middle.straight && ring.straight && pinky.straight) {
    const conf =
      0.4 +
      (index.straightness + middle.straightness + ring.straightness + pinky.straightness) * 0.15;
    return { name: 'openPalm', confidence: clamp01(conf), side: sideOut };
  }

  return null;
}

export interface WaveDetectorState {
  history: Array<{ x: number; t: number }>;
}

export function createWaveState(): WaveDetectorState {
  return { history: [] };
}

const WAVE_WINDOW_MS = 1200;
const WAVE_MIN_ZERO_CROSSINGS = 3;
const WAVE_MIN_AMPLITUDE = 0.05;

export function detectWave(
  state: WaveDetectorState,
  hand: HandInput,
  basis: GestureCandidate | null,
  now: number,
): boolean {
  if (basis?.name !== 'openPalm') {
    state.history.length = 0;
    return false;
  }
  const wrist = hand.landmarks[HAND_INDEX.WRIST];
  if (!wrist) return false;
  state.history.push({ x: wrist.x, t: now });
  while (state.history.length > 0 && now - (state.history[0]?.t ?? now) > WAVE_WINDOW_MS) {
    state.history.shift();
  }
  if (state.history.length < 6) return false;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const sample of state.history) {
    if (sample.x < minX) minX = sample.x;
    if (sample.x > maxX) maxX = sample.x;
  }
  if (maxX - minX < WAVE_MIN_AMPLITUDE) return false;

  const mid = (minX + maxX) / 2;
  let crossings = 0;
  for (let i = 1; i < state.history.length; i += 1) {
    const prev = state.history[i - 1];
    const cur = state.history[i];
    if (!prev || !cur) continue;
    if ((prev.x - mid) * (cur.x - mid) < 0) crossings += 1;
  }
  return crossings >= WAVE_MIN_ZERO_CROSSINGS;
}

export function detectHeartBothHands(
  left: HandInput | null,
  right: HandInput | null,
): GestureCandidate | null {
  if (!left || !right) return null;
  const leftThumb = left.landmarks[HAND_INDEX.THUMB_TIP];
  const rightThumb = right.landmarks[HAND_INDEX.THUMB_TIP];
  const leftIndex = left.landmarks[HAND_INDEX.INDEX_TIP];
  const rightIndex = right.landmarks[HAND_INDEX.INDEX_TIP];
  if (!leftThumb || !rightThumb || !leftIndex || !rightIndex) return null;

  const sizeLeft = handSize(left.landmarks);
  const sizeRight = handSize(right.landmarks);
  const tol = Math.max(sizeLeft, sizeRight) * 0.6;

  const thumbsClose = distance(leftThumb, rightThumb) < tol;
  const indexesClose = distance(leftIndex, rightIndex) < tol;
  if (!thumbsClose || !indexesClose) return null;

  const centerLeft = handCenter(left.landmarks) as HandLandmark;
  const centerRight = handCenter(right.landmarks) as HandLandmark;
  if (centerLeft.x === centerRight.x && centerLeft.y === centerRight.y) return null;

  return { name: 'heart', confidence: 0.8, side: 'both' };
}
