import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { ArmWorldPoints } from '@shared/types';

const TMP_SHOULDER = new THREE.Vector3();
const TMP_ELBOW_REF = new THREE.Vector3();
const TMP_WRIST_REF = new THREE.Vector3();
const TMP_TARGET = new THREE.Vector3();
const TMP_POLE = new THREE.Vector3();
const TMP_AXIS = new THREE.Vector3();
const TMP_PERP = new THREE.Vector3();
const TMP_ELBOW = new THREE.Vector3();
const TMP_UPPER_DIR = new THREE.Vector3();
const TMP_LOWER_DIR = new THREE.Vector3();
const TMP_BIND_DIR = new THREE.Vector3();
const TMP_QUAT = new THREE.Quaternion();
const TMP_PARENT_QUAT = new THREE.Quaternion();
const TMP_INV_QUAT = new THREE.Quaternion();

export interface ArmIKResult {
  upperArmLocalQuat: THREE.Quaternion;
  lowerArmLocalQuat: THREE.Quaternion;
}

export interface ArmIKInput {
  vrm: VRM;
  side: 'Left' | 'Right';
  armWorld: ArmWorldPoints;
  blendFactor: number;
}

export function applyArmIK({ vrm, side, armWorld, blendFactor }: ArmIKInput): void {
  if (!armWorld.visible) return;
  const humanoid = vrm.humanoid;
  if (!humanoid) return;

  const upperBoneName = side === 'Left' ? VRMHumanBoneName.LeftUpperArm : VRMHumanBoneName.RightUpperArm;
  const lowerBoneName = side === 'Left' ? VRMHumanBoneName.LeftLowerArm : VRMHumanBoneName.RightLowerArm;
  const upperBone = humanoid.getNormalizedBoneNode(upperBoneName);
  const lowerBone = humanoid.getNormalizedBoneNode(lowerBoneName);
  if (!upperBone || !lowerBone) return;

  upperBone.parent?.updateWorldMatrix(true, false);
  upperBone.getWorldPosition(TMP_SHOULDER);
  lowerBone.getWorldPosition(TMP_ELBOW_REF);

  const handBoneName = side === 'Left' ? VRMHumanBoneName.LeftHand : VRMHumanBoneName.RightHand;
  const handBone = humanoid.getNormalizedBoneNode(handBoneName);
  if (handBone) handBone.getWorldPosition(TMP_WRIST_REF);
  else TMP_WRIST_REF.copy(TMP_ELBOW_REF);

  const upperLength = TMP_ELBOW_REF.distanceTo(TMP_SHOULDER);
  const lowerLength = TMP_WRIST_REF.distanceTo(TMP_ELBOW_REF);
  if (upperLength <= 0 || lowerLength <= 0) return;

  const userShoulderToWrist = new THREE.Vector3(
    armWorld.wrist.x - armWorld.shoulder.x,
    armWorld.wrist.y - armWorld.shoulder.y,
    armWorld.wrist.z - armWorld.shoulder.z,
  );
  const userArmLength = userShoulderToWrist.length();
  if (userArmLength <= 0) return;
  const avatarArmLength = upperLength + lowerLength;
  const scale = avatarArmLength / userArmLength;

  TMP_TARGET.copy(TMP_SHOULDER).addScaledVector(userShoulderToWrist, scale);

  TMP_POLE.set(
    TMP_SHOULDER.x + (armWorld.elbow.x - armWorld.shoulder.x) * scale,
    TMP_SHOULDER.y + (armWorld.elbow.y - armWorld.shoulder.y) * scale,
    TMP_SHOULDER.z + (armWorld.elbow.z - armWorld.shoulder.z) * scale,
  );

  TMP_AXIS.copy(TMP_TARGET).sub(TMP_SHOULDER);
  const targetDist = TMP_AXIS.length();
  if (targetDist <= 0) return;
  TMP_AXIS.divideScalar(targetDist);

  const maxReach = avatarArmLength * 0.999;
  const reach = Math.min(targetDist, maxReach);

  let cosA = (upperLength * upperLength + reach * reach - lowerLength * lowerLength) /
    (2 * upperLength * reach);
  cosA = clamp(cosA, -1, 1);
  const a = Math.acos(cosA);
  const along = upperLength * Math.cos(a);
  const off = upperLength * Math.sin(a);

  TMP_PERP.copy(TMP_POLE).sub(TMP_SHOULDER);
  const dot = TMP_PERP.dot(TMP_AXIS);
  TMP_PERP.addScaledVector(TMP_AXIS, -dot);
  if (TMP_PERP.lengthSq() < 1e-8) {
    TMP_PERP.set(0, 0, -1);
    const d2 = TMP_PERP.dot(TMP_AXIS);
    TMP_PERP.addScaledVector(TMP_AXIS, -d2);
    if (TMP_PERP.lengthSq() < 1e-8) TMP_PERP.set(0, 1, 0);
  }
  TMP_PERP.normalize();

  TMP_ELBOW.copy(TMP_SHOULDER).addScaledVector(TMP_AXIS, along).addScaledVector(TMP_PERP, off);

  TMP_UPPER_DIR.copy(TMP_ELBOW).sub(TMP_SHOULDER).normalize();
  TMP_LOWER_DIR.copy(TMP_TARGET).sub(TMP_ELBOW).normalize();

  TMP_BIND_DIR.copy(TMP_ELBOW_REF).sub(TMP_SHOULDER).normalize();
  TMP_QUAT.setFromUnitVectors(TMP_BIND_DIR, TMP_UPPER_DIR);
  upperBone.parent?.getWorldQuaternion(TMP_PARENT_QUAT);
  TMP_INV_QUAT.copy(TMP_PARENT_QUAT).invert();
  const upperLocal = new THREE.Quaternion()
    .copy(TMP_INV_QUAT)
    .multiply(TMP_QUAT)
    .multiply(TMP_PARENT_QUAT);
  upperBone.quaternion.slerp(upperLocal, blendFactor);

  upperBone.updateMatrixWorld(true);

  TMP_BIND_DIR.copy(TMP_WRIST_REF).sub(TMP_ELBOW_REF).normalize();
  TMP_QUAT.setFromUnitVectors(TMP_BIND_DIR, TMP_LOWER_DIR);
  lowerBone.parent?.getWorldQuaternion(TMP_PARENT_QUAT);
  TMP_INV_QUAT.copy(TMP_PARENT_QUAT).invert();
  const lowerLocal = new THREE.Quaternion()
    .copy(TMP_INV_QUAT)
    .multiply(TMP_QUAT)
    .multiply(TMP_PARENT_QUAT);
  lowerBone.quaternion.slerp(lowerLocal, blendFactor);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
