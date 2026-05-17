import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import { REST_LEFT_UPPER_ARM, REST_RIGHT_UPPER_ARM, REST_LOWER_ARM } from './rest-pose';

const BREATHE_AMPLITUDE = 0.012;
const BREATHE_FREQUENCY = 0.4;
const SWAY_AMPLITUDE = 0.018;
const SWAY_FREQUENCY = 0.25;

export interface IdleAnimationState {
  elapsedSeconds: number;
}

export function createIdleState(): IdleAnimationState {
  return { elapsedSeconds: 0 };
}

export function applyIdleAnimation(
  vrm: VRM,
  state: IdleAnimationState,
  deltaSeconds: number,
): void {
  state.elapsedSeconds += deltaSeconds;

  const spine = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
  if (spine) {
    const breathe = Math.sin(state.elapsedSeconds * BREATHE_FREQUENCY * Math.PI * 2) * BREATHE_AMPLITUDE;
    const sway = Math.sin(state.elapsedSeconds * SWAY_FREQUENCY * Math.PI * 2) * SWAY_AMPLITUDE;
    spine.rotation.x = breathe;
    spine.rotation.z = sway;
  }

  const upperChest =
    vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.UpperChest) ||
    vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Chest);
  if (upperChest) {
    const scale = 1 + Math.sin(state.elapsedSeconds * BREATHE_FREQUENCY * Math.PI * 2) * 0.008;
    upperChest.scale.set(scale, scale, scale);
  }

  applyRestArms(vrm);
}

export function applyRestArms(vrm: VRM): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const leftUpper = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
  const rightUpper = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
  const leftLower = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
  const rightLower = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
  if (leftUpper) leftUpper.quaternion.copy(REST_LEFT_UPPER_ARM);
  if (rightUpper) rightUpper.quaternion.copy(REST_RIGHT_UPPER_ARM);
  if (leftLower) leftLower.quaternion.copy(REST_LOWER_ARM);
  if (rightLower) rightLower.quaternion.copy(REST_LOWER_ARM);
}

export function resetIdle(vrm: VRM): void {
  const spine = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
  if (spine) spine.rotation.set(0, 0, 0);

  const upperChest =
    vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.UpperChest) ||
    vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Chest);
  if (upperChest) upperChest.scale.set(1, 1, 1);
}

export function getDefaultHeadPosition(vrm: VRM): THREE.Vector3 {
  const head = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head);
  if (!head) return new THREE.Vector3(0, 1.5, 0);
  const pos = new THREE.Vector3();
  head.getWorldPosition(pos);
  return pos;
}
