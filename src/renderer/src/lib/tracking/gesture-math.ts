export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandInput {
  landmarks: HandLandmark[];
  side: 'Left' | 'Right';
}

export const HAND_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const STRAIGHT_COS = 0.85;
export const BENT_COS = 0.5;

export function vec(a: HandLandmark, b: HandLandmark): HandLandmark {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

export function length(v: HandLandmark): number {
  return Math.hypot(v.x, v.y, v.z) || 1e-6;
}

export function dot(a: HandLandmark, b: HandLandmark): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cosAngle(a: HandLandmark, b: HandLandmark, c: HandLandmark): number {
  const ba = vec(b, a);
  const bc = vec(b, c);
  return dot(ba, bc) / (length(ba) * length(bc));
}

export function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export interface FingerState {
  straight: boolean;
  bent: boolean;
  straightness: number;
}

export function fingerState(
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

export function thumbExtended(lm: HandLandmark[]): boolean {
  const wrist = lm[HAND_INDEX.WRIST];
  const mcp = lm[HAND_INDEX.THUMB_MCP];
  const tip = lm[HAND_INDEX.THUMB_TIP];
  if (!wrist || !mcp || !tip) return false;
  return distance(wrist, tip) > distance(wrist, mcp) * 1.4;
}

export function thumbsUpOrientation(lm: HandLandmark[]): boolean {
  const tip = lm[HAND_INDEX.THUMB_TIP];
  const wrist = lm[HAND_INDEX.WRIST];
  if (!tip || !wrist) return false;
  return tip.y < wrist.y - 0.08;
}

export function handCenter(lm: HandLandmark[]): HandLandmark {
  const wrist = lm[HAND_INDEX.WRIST];
  const midKnuckle = lm[HAND_INDEX.MIDDLE_MCP];
  if (!wrist || !midKnuckle) return { x: 0, y: 0, z: 0 };
  return {
    x: (wrist.x + midKnuckle.x) / 2,
    y: (wrist.y + midKnuckle.y) / 2,
    z: (wrist.z + midKnuckle.z) / 2,
  };
}

export function handSize(lm: HandLandmark[]): number {
  const wrist = lm[HAND_INDEX.WRIST];
  const midKnuckle = lm[HAND_INDEX.MIDDLE_MCP];
  if (!wrist || !midKnuckle) return 1;
  return Math.max(distance(wrist, midKnuckle), 0.05);
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
