import { VRMHumanBoneName, type VRM, type VRMExpressionPresetName } from '@pixiv/three-vrm';
import type { PoseFrame } from '@shared/types';
import { applyEulerToBone, clamp01 } from './vrm-shared';

const SLERP_HEAD = 0.5;
const HEAD_DAMPENER = 0.7;
const BLINK_THRESHOLD_OPEN = 0.5;

const EXPRESSION_PRESETS: VRMExpressionPresetName[] = [
  'happy' as VRMExpressionPresetName,
  'angry' as VRMExpressionPresetName,
  'sad' as VRMExpressionPresetName,
  'surprised' as VRMExpressionPresetName,
  'relaxed' as VRMExpressionPresetName,
];

export interface FaceApplyOptions {
  mirror: boolean;
  lipsyncFromCamera: boolean;
  lipsyncFromMic: boolean;
  audioVolume: number;
}

export function applyFace(vrm: VRM, frame: PoseFrame, options: FaceApplyOptions): void {
  const face = frame.face;
  if (!face) return;
  const { mirror, lipsyncFromCamera, lipsyncFromMic } = options;
  applyEulerToBone(
    vrm,
    VRMHumanBoneName.Neck,
    {
      x: face.head.x * HEAD_DAMPENER,
      y: face.head.y * HEAD_DAMPENER * (mirror ? -1 : 1),
      z: face.head.z * HEAD_DAMPENER * (mirror ? -1 : 1),
    },
    SLERP_HEAD,
  );
  const manager = vrm.expressionManager;
  if (!manager) return;

  const leftBlink = blinkFromOpenness(mirror ? face.eyeR : face.eyeL);
  const rightBlink = blinkFromOpenness(mirror ? face.eyeL : face.eyeR);
  manager.setValue('blink' as VRMExpressionPresetName, 0);
  manager.setValue('blinkLeft' as VRMExpressionPresetName, leftBlink);
  manager.setValue('blinkRight' as VRMExpressionPresetName, rightBlink);

  const camA = lipsyncFromCamera ? face.mouth.A : 0;
  const camI = lipsyncFromCamera ? face.mouth.I : 0;
  const camU = lipsyncFromCamera ? face.mouth.U : 0;
  const camE = lipsyncFromCamera ? face.mouth.E : 0;
  const camO = lipsyncFromCamera ? face.mouth.O : 0;
  const micA = lipsyncFromMic ? frame.audioPhonemes?.A ?? 0 : 0;
  const micI = lipsyncFromMic ? frame.audioPhonemes?.I ?? 0 : 0;
  const micU = lipsyncFromMic ? frame.audioPhonemes?.U ?? 0 : 0;
  const micE = lipsyncFromMic ? frame.audioPhonemes?.E ?? 0 : 0;
  const micO = lipsyncFromMic ? frame.audioPhonemes?.O ?? 0 : 0;
  const voiceBoost = lipsyncFromMic ? clamp01(options.audioVolume * 1.4) : 0;
  manager.setValue('aa' as VRMExpressionPresetName, Math.max(camA, micA, voiceBoost * 0.85));
  manager.setValue('ih' as VRMExpressionPresetName, Math.max(camI, micI));
  manager.setValue('ou' as VRMExpressionPresetName, Math.max(camU, micU));
  manager.setValue('ee' as VRMExpressionPresetName, Math.max(camE, micE));
  manager.setValue('oh' as VRMExpressionPresetName, Math.max(camO, micO));
  if (voiceBoost > 0) {
    const jawCurrent = manager.getValue('jawOpen' as VRMExpressionPresetName) ?? 0;
    manager.setValue('jawOpen' as VRMExpressionPresetName, Math.max(jawCurrent, voiceBoost * 0.7));
  }

  manager.setValue('surprised' as VRMExpressionPresetName, face.brow);
}

export function applyGaze(vrm: VRM, frame: PoseFrame, mirror: boolean): void {
  const face = frame.face;
  const manager = vrm.expressionManager;
  if (!face || !manager) return;
  if (face.eyeL < 0.3 && face.eyeR < 0.3) return;

  const gx = mirror ? -face.gazeX : face.gazeX;
  const gy = face.gazeY;

  manager.setValue('lookLeft' as VRMExpressionPresetName, gx < 0 ? Math.min(1, -gx) : 0);
  manager.setValue('lookRight' as VRMExpressionPresetName, gx > 0 ? Math.min(1, gx) : 0);
  manager.setValue('lookUp' as VRMExpressionPresetName, gy < 0 ? Math.min(1, -gy) : 0);
  manager.setValue('lookDown' as VRMExpressionPresetName, gy > 0 ? Math.min(1, gy) : 0);
}

export function applyExpression(vrm: VRM, frame: PoseFrame): void {
  const manager = vrm.expressionManager;
  if (!manager) return;
  const target = frame.expression;
  for (const preset of EXPRESSION_PRESETS) {
    const isTarget = target?.name === preset;
    manager.setValue(preset, isTarget ? clamp01(target.weight) : 0);
  }
}

function blinkFromOpenness(openness: number): number {
  if (openness >= BLINK_THRESHOLD_OPEN) return 0;
  const range = BLINK_THRESHOLD_OPEN;
  return clamp01(1 - openness / range);
}
