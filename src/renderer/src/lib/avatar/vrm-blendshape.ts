import type { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import type { PoseFrame } from '@shared/types';
import { clamp01 } from './vrm-shared';

export const ARKIT_TO_VRM_BLENDSHAPE: Readonly<Record<string, string>> = {
  browDownLeft: 'browDownLeft',
  browDownRight: 'browDownRight',
  browInnerUp: 'browInnerUp',
  browOuterUpLeft: 'browOuterUpLeft',
  browOuterUpRight: 'browOuterUpRight',
  cheekPuff: 'cheekPuff',
  cheekSquintLeft: 'cheekSquintLeft',
  cheekSquintRight: 'cheekSquintRight',
  eyeBlinkLeft: 'eyeBlinkLeft',
  eyeBlinkRight: 'eyeBlinkRight',
  eyeLookDownLeft: 'eyeLookDownLeft',
  eyeLookDownRight: 'eyeLookDownRight',
  eyeLookInLeft: 'eyeLookInLeft',
  eyeLookInRight: 'eyeLookInRight',
  eyeLookOutLeft: 'eyeLookOutLeft',
  eyeLookOutRight: 'eyeLookOutRight',
  eyeLookUpLeft: 'eyeLookUpLeft',
  eyeLookUpRight: 'eyeLookUpRight',
  eyeSquintLeft: 'eyeSquintLeft',
  eyeSquintRight: 'eyeSquintRight',
  eyeWideLeft: 'eyeWideLeft',
  eyeWideRight: 'eyeWideRight',
  jawForward: 'jawForward',
  jawLeft: 'jawLeft',
  jawOpen: 'jawOpen',
  jawRight: 'jawRight',
  mouthClose: 'mouthClose',
  mouthDimpleLeft: 'mouthDimpleLeft',
  mouthDimpleRight: 'mouthDimpleRight',
  mouthFrownLeft: 'mouthFrownLeft',
  mouthFrownRight: 'mouthFrownRight',
  mouthFunnel: 'mouthFunnel',
  mouthLeft: 'mouthLeft',
  mouthLowerDownLeft: 'mouthLowerDownLeft',
  mouthLowerDownRight: 'mouthLowerDownRight',
  mouthPressLeft: 'mouthPressLeft',
  mouthPressRight: 'mouthPressRight',
  mouthPucker: 'mouthPucker',
  mouthRight: 'mouthRight',
  mouthRollLower: 'mouthRollLower',
  mouthRollUpper: 'mouthRollUpper',
  mouthShrugLower: 'mouthShrugLower',
  mouthShrugUpper: 'mouthShrugUpper',
  mouthSmileLeft: 'mouthSmileLeft',
  mouthSmileRight: 'mouthSmileRight',
  mouthStretchLeft: 'mouthStretchLeft',
  mouthStretchRight: 'mouthStretchRight',
  mouthUpperUpLeft: 'mouthUpperUpLeft',
  mouthUpperUpRight: 'mouthUpperUpRight',
  noseSneerLeft: 'noseSneerLeft',
  noseSneerRight: 'noseSneerRight',
  tongueOut: 'tongueOut',
};

interface VrmCapabilities {
  isArkit: boolean;
  resolve: (name: string) => string | null;
}

const capabilityCache = new WeakMap<VRM, VrmCapabilities>();

export function resetVrmCapabilityCache(vrm: VRM): void {
  capabilityCache.delete(vrm);
}

export function getCapabilities(vrm: VRM): VrmCapabilities {
  const cached = capabilityCache.get(vrm);
  if (cached) return cached;
  const manager = vrm.expressionManager;
  const lowerToActual = new Map<string, string>();
  for (const expr of manager?.expressions ?? []) {
    lowerToActual.set(expr.expressionName.toLowerCase(), expr.expressionName);
  }
  const resolve = (n: string): string | null => lowerToActual.get(n.toLowerCase()) ?? null;
  const isArkit = resolve('eyeBlinkLeft') !== null && resolve('jawOpen') !== null;
  const caps: VrmCapabilities = { isArkit, resolve };
  capabilityCache.set(vrm, caps);
  return caps;
}

// Wink-Verstärkung: Beim echten Einäugig-Zwinkern zieht MediaPipe BEIDE Augen etwas zu —
// dann kippt oft keines über die Schwelle. Ist die Differenz groß genug, spreizen wir:
// das geschlossenere Auge wird ganz zu, das offenere bleibt offen.
const WINK_DIFF_THRESHOLD = 0.22;

export function enhanceWink(left: number, right: number): { left: number; right: number } {
  const diff = left - right;
  if (Math.abs(diff) < WINK_DIFF_THRESHOLD) return { left, right };
  if (diff > 0) {
    return { left: clamp01(left * 1.45), right: right * 0.4 };
  }
  return { left: left * 0.4, right: clamp01(right * 1.45) };
}

function maxN(...values: Array<number | undefined>): number {
  let m = 0;
  for (const v of values) if (typeof v === 'number' && v > m) m = v;
  return m;
}

export function applyAllBlendShapes(vrm: VRM, frame: PoseFrame): void {
  const blendShapes = frame.blendShapes;
  const manager = vrm.expressionManager;
  if (!blendShapes || !manager) return;
  const caps = getCapabilities(vrm);

  if (caps.isArkit) {
    const wink = enhanceWink(blendShapes['eyeBlinkLeft'] ?? 0, blendShapes['eyeBlinkRight'] ?? 0);
    for (const mpName of Object.keys(ARKIT_TO_VRM_BLENDSHAPE)) {
      let value = blendShapes[mpName];
      if (mpName === 'eyeBlinkLeft') value = wink.left;
      if (mpName === 'eyeBlinkRight') value = wink.right;
      if (typeof value !== 'number') continue;
      const actual = caps.resolve(mpName);
      if (actual) manager.setValue(actual as VRMExpressionPresetName, clamp01(value));
    }
    return;
  }

  const setIf = (name: string, value: number): void => {
    const actual = caps.resolve(name);
    if (!actual) return;
    manager.setValue(actual as VRMExpressionPresetName, clamp01(value));
  };

  const wink = enhanceWink(blendShapes['eyeBlinkLeft'] ?? 0, blendShapes['eyeBlinkRight'] ?? 0);
  setIf('blink_l', wink.left);
  setIf('blinkLeft', wink.left);
  setIf('blink_r', wink.right);
  setIf('blinkRight', wink.right);
  setIf('blink', Math.max(wink.left, wink.right));

  const jaw = blendShapes['jawOpen'] ?? 0;
  setIf('aa', jaw);
  setIf('a', jaw);

  const funnel = blendShapes['mouthFunnel'] ?? 0;
  setIf('oh', funnel);
  setIf('o', funnel);

  const pucker = blendShapes['mouthPucker'] ?? 0;
  setIf('ou', pucker);
  setIf('u', pucker);

  const smile = maxN(blendShapes['mouthSmileLeft'], blendShapes['mouthSmileRight']);
  setIf('happy', smile);
  setIf('joy', smile);

  const frown = maxN(blendShapes['mouthFrownLeft'], blendShapes['mouthFrownRight']);
  setIf('sad', frown);
  setIf('sorrow', frown);

  const browUp = maxN(
    blendShapes['browInnerUp'],
    blendShapes['browOuterUpLeft'],
    blendShapes['browOuterUpRight'],
  );
  setIf('surprised', browUp);

  const browDown = maxN(blendShapes['browDownLeft'], blendShapes['browDownRight']);
  setIf('angry', browDown);
}
