import type { GestureName } from '@shared/types';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandInput {
  landmarks: HandLandmark[];
  side: 'Left' | 'Right';
}

export interface GestureCandidate {
  name: GestureName;
  confidence: number;
  side: 'left' | 'right' | 'both';
}

const WRIST = 0;
const THUMB_CMC = 1;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_DIP = 7;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_DIP = 11;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_DIP = 15;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_DIP = 19;
const PINKY_TIP = 20;

const STRAIGHT_COS = 0.85;
const BENT_COS = 0.5;

function vec(a: HandLandmark, b: HandLandmark): HandLandmark {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function length(v: HandLandmark): number {
  return Math.hypot(v.x, v.y, v.z) || 1e-6;
}

function dot(a: HandLandmark, b: HandLandmark): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cosAngle(a: HandLandmark, b: HandLandmark, c: HandLandmark): number {
  const ba = vec(b, a);
  const bc = vec(b, c);
  return dot(ba, bc) / (length(ba) * length(bc));
}

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

interface FingerState {
  straight: boolean;
  bent: boolean;
  straightness: number;
}

function fingerState(
  lm: HandLandmark[],
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
): FingerState {
  const m = lm[mcp];
  const p = lm[pip];
  const d = lm[dip];
  const t = lm[tip];
  if (!m || !p || !d || !t) return { straight: false, bent: false, straightness: 0 };
  const cosPip = cosAngle(m, p, d);
  const cosDip = cosAngle(p, d, t);
  const straightness = (cosPip + cosDip) / 2;
  return {
    straight: cosPip < -STRAIGHT_COS && cosDip < -STRAIGHT_COS,
    bent: cosPip > -BENT_COS || cosDip > -BENT_COS,
    straightness: Math.max(0, -straightness),
  };
}

function thumbExtended(lm: HandLandmark[]): boolean {
  const wrist = lm[WRIST];
  const cmc = lm[THUMB_CMC];
  const mcp = lm[THUMB_MCP];
  const ip = lm[THUMB_IP];
  const tip = lm[THUMB_TIP];
  if (!wrist || !cmc || !mcp || !ip || !tip) return false;
  return distance(wrist, tip) > distance(wrist, mcp) * 1.4;
}

function thumbsUpOrientation(lm: HandLandmark[]): boolean {
  const tip = lm[THUMB_TIP];
  const wrist = lm[WRIST];
  if (!tip || !wrist) return false;
  return tip.y < wrist.y - 0.08;
}

function handCenter(lm: HandLandmark[]): HandLandmark {
  const wrist = lm[WRIST];
  const midKnuckle = lm[MIDDLE_MCP];
  if (!wrist || !midKnuckle) return { x: 0, y: 0, z: 0 };
  return {
    x: (wrist.x + midKnuckle.x) / 2,
    y: (wrist.y + midKnuckle.y) / 2,
    z: (wrist.z + midKnuckle.z) / 2,
  };
}

function handSize(lm: HandLandmark[]): number {
  const wrist = lm[WRIST];
  const midKnuckle = lm[MIDDLE_MCP];
  if (!wrist || !midKnuckle) return 1;
  return Math.max(distance(wrist, midKnuckle), 0.05);
}

export function detectSingleHandGesture(hand: HandInput): GestureCandidate | null {
  const lm = hand.landmarks;
  if (lm.length < 21) return null;
  const sideOut = hand.side === 'Left' ? 'left' : 'right';

  const index = fingerState(lm, INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP);
  const middle = fingerState(lm, MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP);
  const ring = fingerState(lm, RING_MCP, RING_PIP, RING_DIP, RING_TIP);
  const pinky = fingerState(lm, PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP);
  const thumbOut = thumbExtended(lm);

  const indexTip = lm[INDEX_TIP];
  const thumbTip = lm[THUMB_TIP];
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
  const wrist = hand.landmarks[WRIST];
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

export function detectHeartBothHands(left: HandInput | null, right: HandInput | null): GestureCandidate | null {
  if (!left || !right) return null;
  const leftThumb = left.landmarks[THUMB_TIP];
  const rightThumb = right.landmarks[THUMB_TIP];
  const leftIndex = left.landmarks[INDEX_TIP];
  const rightIndex = right.landmarks[INDEX_TIP];
  if (!leftThumb || !rightThumb || !leftIndex || !rightIndex) return null;

  const sizeLeft = handSize(left.landmarks);
  const sizeRight = handSize(right.landmarks);
  const tol = Math.max(sizeLeft, sizeRight) * 0.6;

  const thumbsClose = distance(leftThumb, rightThumb) < tol;
  const indexesClose = distance(leftIndex, rightIndex) < tol;
  if (!thumbsClose || !indexesClose) return null;

  const centerLeft = handCenter(left.landmarks);
  const centerRight = handCenter(right.landmarks);
  if (centerLeft.x === centerRight.x && centerLeft.y === centerRight.y) return null;

  return { name: 'heart', confidence: 0.8, side: 'both' };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
