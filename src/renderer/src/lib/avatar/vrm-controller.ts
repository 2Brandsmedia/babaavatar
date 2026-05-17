import * as THREE from 'three';
import { VRMHumanBoneName, type VRM, type VRMExpressionPresetName } from '@pixiv/three-vrm';
import type { PoseFrame, Vec3 } from '@shared/types';
import { REST_LEFT_UPPER_ARM, REST_RIGHT_UPPER_ARM, REST_LOWER_ARM } from './rest-pose';
import { applyArmIK } from './arm-ik';

const REUSE_EULER = new THREE.Euler();
const REUSE_QUAT = new THREE.Quaternion();

const SLERP_HEAD = 0.5;
const SLERP_SPINE = 0.4;
const SLERP_ARM = 0.65;
const SLERP_REST = 0.08;
const HEAD_DAMPENER = 0.7;
const SPINE_DAMPENER = 0.2;
const ARM_DAMPENER = 1.0;
const BLINK_THRESHOLD_OPEN = 0.5;
const SPINE_DEAD_ZONE = 0.05;

export interface VrmControllerOptions {
  mirror: boolean;
  lipsyncFromCamera: boolean;
  lipsyncFromMic: boolean;
  armIkEnabled: boolean;
  handTrackingEnabled: boolean;
  audioVolume: number;
}

const IK_BLEND_FACTOR = 0.5;

export function applyPoseToVrm(
  vrm: VRM,
  frame: PoseFrame,
  options: VrmControllerOptions,
): void {
  applyFace(vrm, frame, options);
  applyAllBlendShapes(vrm, frame);
  applyGaze(vrm, frame, options.mirror);
  if (options.handTrackingEnabled) {
    applyPose(vrm, frame, options.mirror);
    if (options.armIkEnabled && frame.pose) {
      if (frame.pose.leftArmWorld?.visible) {
        applyArmIK({ vrm, side: 'Left', armWorld: frame.pose.leftArmWorld, blendFactor: IK_BLEND_FACTOR });
      }
      if (frame.pose.rightArmWorld?.visible) {
        applyArmIK({ vrm, side: 'Right', armWorld: frame.pose.rightArmWorld, blendFactor: IK_BLEND_FACTOR });
      }
    }
    applyHands(vrm, frame);
  } else {
    applyArmRestPose(vrm);
  }
  applyExpression(vrm, frame);
}

const ARKIT_TO_VRM_BLENDSHAPE: Readonly<Record<string, string>> = {
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

function applyAllBlendShapes(vrm: VRM, frame: PoseFrame): void {
  const blendShapes = frame.blendShapes;
  const manager = vrm.expressionManager;
  if (!blendShapes || !manager) return;
  for (const [mpName, vrmName] of Object.entries(ARKIT_TO_VRM_BLENDSHAPE)) {
    const value = blendShapes[mpName];
    if (typeof value === 'number') {
      manager.setValue(vrmName as VRMExpressionPresetName, clamp01(value));
    }
  }
}

function applyGaze(vrm: VRM, frame: PoseFrame, mirror: boolean): void {
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

const FINGER_SLERP = 0.6;

function applyHands(vrm: VRM, frame: PoseFrame): void {
  const hands = frame.hands;
  if (!hands) return;
  if (hands.left) applyHand(vrm, hands.left, 'Left');
  if (hands.right) applyHand(vrm, hands.right, 'Right');
}

function applyHand(vrm: VRM, hand: import('@shared/types').HandRig, side: 'Left' | 'Right'): void {
  const fingers: Array<['Thumb' | 'Index' | 'Middle' | 'Ring' | 'Little', import('@shared/types').HandFingerRig]> = [
    ['Thumb', hand.thumb],
    ['Index', hand.index],
    ['Middle', hand.middle],
    ['Ring', hand.ring],
    ['Little', hand.little],
  ];
  for (const [name, finger] of fingers) {
    applyBoneEuler(vrm, `${side}${name}Proximal` as VRMHumanBoneName, finger.proximal);
    applyBoneEuler(vrm, `${side}${name}Intermediate` as VRMHumanBoneName, finger.intermediate);
    applyBoneEuler(vrm, `${side}${name}Distal` as VRMHumanBoneName, finger.distal);
  }
}

function applyBoneEuler(vrm: VRM, boneName: VRMHumanBoneName, euler: Vec3): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const bone = humanoid.getNormalizedBoneNode(boneName);
  if (!bone) return;
  REUSE_EULER.set(euler.x, euler.y, euler.z);
  REUSE_QUAT.setFromEuler(REUSE_EULER);
  bone.quaternion.slerp(REUSE_QUAT, FINGER_SLERP);
}

function applyFace(vrm: VRM, frame: PoseFrame, options: VrmControllerOptions): void {
  const face = frame.face;
  if (!face) return;
  const { mirror, lipsyncFromCamera, lipsyncFromMic } = options;
  applyEuler(
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
    manager.setValue(
      'jawOpen' as VRMExpressionPresetName,
      Math.max(jawCurrent, voiceBoost * 0.7),
    );
  }

  manager.setValue('surprised' as VRMExpressionPresetName, face.brow);
}

function applyPose(vrm: VRM, frame: PoseFrame, mirror: boolean): void {
  const pose = frame.pose;
  if (!pose) {
    applyArmRestPose(vrm);
    return;
  }

  const sx = Math.abs(pose.spine.x) < SPINE_DEAD_ZONE ? 0 : pose.spine.x;
  const sy = Math.abs(pose.spine.y) < SPINE_DEAD_ZONE ? 0 : pose.spine.y;
  const sz = Math.abs(pose.spine.z) < SPINE_DEAD_ZONE ? 0 : pose.spine.z;

  applyEuler(
    vrm,
    VRMHumanBoneName.Spine,
    {
      x: sx * SPINE_DAMPENER,
      y: sy * SPINE_DAMPENER * (mirror ? -1 : 1),
      z: sz * SPINE_DAMPENER * (mirror ? -1 : 1),
    },
    SLERP_SPINE,
  );

  applyArm(
    vrm,
    pose.leftUpperArm,
    pose.leftLowerArm,
    pose.armsVisible.left,
    VRMHumanBoneName.LeftUpperArm,
    VRMHumanBoneName.LeftLowerArm,
    REST_LEFT_UPPER_ARM,
  );
  applyArm(
    vrm,
    pose.rightUpperArm,
    pose.rightLowerArm,
    pose.armsVisible.right,
    VRMHumanBoneName.RightUpperArm,
    VRMHumanBoneName.RightLowerArm,
    REST_RIGHT_UPPER_ARM,
  );
}

function applyArm(
  vrm: VRM,
  upper: Vec3,
  lower: Vec3,
  visible: boolean,
  upperBoneName: VRMHumanBoneName,
  lowerBoneName: VRMHumanBoneName,
  restUpper: THREE.Quaternion,
): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const upperBone = humanoid.getNormalizedBoneNode(upperBoneName);
  const lowerBone = humanoid.getNormalizedBoneNode(lowerBoneName);

  if (!visible) {
    if (upperBone) upperBone.quaternion.slerp(restUpper, SLERP_REST);
    if (lowerBone) lowerBone.quaternion.slerp(REST_LOWER_ARM, SLERP_REST);
    return;
  }

  if (upperBone) {
    REUSE_EULER.set(upper.x * ARM_DAMPENER, upper.y * ARM_DAMPENER, upper.z * ARM_DAMPENER);
    REUSE_QUAT.setFromEuler(REUSE_EULER);
    upperBone.quaternion.slerp(REUSE_QUAT, SLERP_ARM);
  }
  if (lowerBone) {
    REUSE_EULER.set(lower.x * ARM_DAMPENER, lower.y * ARM_DAMPENER, lower.z * ARM_DAMPENER);
    REUSE_QUAT.setFromEuler(REUSE_EULER);
    lowerBone.quaternion.slerp(REUSE_QUAT, SLERP_ARM);
  }
}

function applyArmRestPose(vrm: VRM): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const leftUpper = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
  const rightUpper = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
  const leftLower = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
  const rightLower = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
  if (leftUpper) leftUpper.quaternion.slerp(REST_LEFT_UPPER_ARM, SLERP_REST);
  if (rightUpper) rightUpper.quaternion.slerp(REST_RIGHT_UPPER_ARM, SLERP_REST);
  if (leftLower) leftLower.quaternion.slerp(REST_LOWER_ARM, SLERP_REST);
  if (rightLower) rightLower.quaternion.slerp(REST_LOWER_ARM, SLERP_REST);
}

function applyExpression(vrm: VRM, frame: PoseFrame): void {
  if (!frame.expression || !vrm.expressionManager) return;
  vrm.expressionManager.setValue(
    frame.expression.name as VRMExpressionPresetName,
    clamp01(frame.expression.weight),
  );
}

function applyEuler(
  vrm: VRM,
  boneName: VRMHumanBoneName,
  euler: Vec3,
  slerpAmount: number,
): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const bone = humanoid.getNormalizedBoneNode(boneName);
  if (!bone) return;
  REUSE_EULER.set(euler.x, euler.y, euler.z);
  REUSE_QUAT.setFromEuler(REUSE_EULER);
  bone.quaternion.slerp(REUSE_QUAT, slerpAmount);
}

function blinkFromOpenness(openness: number): number {
  if (openness >= BLINK_THRESHOLD_OPEN) return 0;
  const range = BLINK_THRESHOLD_OPEN;
  return clamp01(1 - openness / range);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
