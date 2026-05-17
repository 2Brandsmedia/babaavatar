import * as THREE from 'three';
import { VRMHumanBoneName, type VRM, type VRMExpressionPresetName } from '@pixiv/three-vrm';
import type { PoseFrame, Vec3 } from '@shared/types';
import { REST_LEFT_UPPER_ARM, REST_RIGHT_UPPER_ARM, REST_LOWER_ARM } from './rest-pose';

const REUSE_EULER = new THREE.Euler();
const REUSE_QUAT = new THREE.Quaternion();

const SLERP_HEAD = 0.5;
const SLERP_SPINE = 0.4;
const SLERP_ARM = 0.65;
const SLERP_REST = 0.08;
const HEAD_DAMPENER = 0.7;
const SPINE_DAMPENER = 0.45;
const ARM_DAMPENER = 1.0;
const BLINK_THRESHOLD_OPEN = 0.5;

export interface VrmControllerOptions {
  mirror: boolean;
}

export function applyPoseToVrm(
  vrm: VRM,
  frame: PoseFrame,
  options: VrmControllerOptions,
): void {
  applyFace(vrm, frame, options.mirror);
  applyPose(vrm, frame);
  applyExpression(vrm, frame);
}

function applyFace(vrm: VRM, frame: PoseFrame, mirror: boolean): void {
  const face = frame.face;
  if (!face) return;
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

  const audio = frame.audioPhonemes;
  const phoneA = Math.max(face.mouth.A, audio?.A ?? 0);
  const phoneI = Math.max(face.mouth.I, audio?.I ?? 0);
  const phoneU = Math.max(face.mouth.U, audio?.U ?? 0);
  const phoneE = Math.max(face.mouth.E, audio?.E ?? 0);
  const phoneO = Math.max(face.mouth.O, audio?.O ?? 0);
  manager.setValue('aa' as VRMExpressionPresetName, phoneA);
  manager.setValue('ih' as VRMExpressionPresetName, phoneI);
  manager.setValue('ou' as VRMExpressionPresetName, phoneU);
  manager.setValue('ee' as VRMExpressionPresetName, phoneE);
  manager.setValue('oh' as VRMExpressionPresetName, phoneO);

  manager.setValue('surprised' as VRMExpressionPresetName, face.brow);
}

function applyPose(vrm: VRM, frame: PoseFrame): void {
  const pose = frame.pose;
  if (!pose) {
    applyArmRestPose(vrm);
    return;
  }

  applyEuler(
    vrm,
    VRMHumanBoneName.Spine,
    {
      x: pose.spine.x * SPINE_DAMPENER,
      y: pose.spine.y * SPINE_DAMPENER,
      z: pose.spine.z * SPINE_DAMPENER,
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
