import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { Vec3 } from '@shared/types';

const REUSE_EULER = new THREE.Euler();
const REUSE_QUAT = new THREE.Quaternion();

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// Framerate-unabhängige Glättung: Die Slerp-Konstanten sind für 60 FPS kalibriert.
// Bei anderem Frame-Takt wird der Faktor so umgerechnet, dass die Bewegung pro
// SEKUNDE identisch bleibt — sonst wird der Avatar bei FPS-Einbrüchen zäh
// und bei hohen FPS nervös.
export function dtAlpha(alphaAt60: number, delta: number): number {
  if (delta <= 0) return alphaAt60;
  const frames = delta * 60;
  return clamp01(1 - Math.pow(1 - alphaAt60, frames));
}

export function applyEulerToBone(
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

export function slerpBoneToQuat(
  vrm: VRM,
  boneName: VRMHumanBoneName,
  target: THREE.Quaternion,
  slerpAmount: number,
): void {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  const bone = humanoid.getNormalizedBoneNode(boneName);
  if (!bone) return;
  bone.quaternion.slerp(target, slerpAmount);
}
