import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { PoseFrame, Vec3 } from '@shared/types';
import { REST_LEFT_UPPER_ARM, REST_RIGHT_UPPER_ARM, REST_LOWER_ARM, REST_LEG } from './rest-pose';
import { applyEulerToBone, dtAlpha, slerpBoneToQuat } from './vrm-shared';

const SLERP_SPINE = 0.4;
const SLERP_ARM = 0.65;
const SLERP_REST = 0.08;
// 0.2 war zu steif — der Oberkörper soll sichtbar mitgehen. Die Rotation wird
// zusätzlich auf den Chest-Knochen verteilt (natürlichere Kurve statt Knick).
const SPINE_DAMPENER = 0.35;
const CHEST_SHARE = 0.6;
const ARM_DAMPENER = 1.0;
const SPINE_DEAD_ZONE = 0.05;
// Hüfte bewusst gedämpft und träge: sie trägt den ganzen Avatar, Rauschen hier
// wirkt wie Schwanken des gesamten Körpers.
const SLERP_HIPS = 0.3;
const HIPS_DAMPENER = 0.55;
const HIPS_DEAD_ZONE = 0.03;
const SLERP_LEG = 0.5;
const LEG_DAMPENER = 0.85;
// Anatomische Grenze: mehr als ~150° Kniebeugung liefert die Webcam ohnehin nicht sauber.
const LEG_MAX_RAD = 2.6;

export function applyPose(
  vrm: VRM,
  frame: PoseFrame,
  mirror: boolean,
  legsEnabled: boolean,
  delta: number,
): void {
  const pose = frame.pose;
  if (!pose) {
    applyArmRestPose(vrm, delta);
    applyLegRestPose(vrm, delta);
    return;
  }

  applyHips(vrm, pose.hipsRotation, mirror, delta);

  const sx = Math.abs(pose.spine.x) < SPINE_DEAD_ZONE ? 0 : pose.spine.x;
  const sy = Math.abs(pose.spine.y) < SPINE_DEAD_ZONE ? 0 : pose.spine.y;
  const sz = Math.abs(pose.spine.z) < SPINE_DEAD_ZONE ? 0 : pose.spine.z;

  const spineEuler = {
    x: sx * SPINE_DAMPENER,
    y: sy * SPINE_DAMPENER * (mirror ? -1 : 1),
    z: sz * SPINE_DAMPENER * (mirror ? -1 : 1),
  };
  applyEulerToBone(vrm, VRMHumanBoneName.Spine, spineEuler, dtAlpha(SLERP_SPINE, delta));
  applyEulerToBone(
    vrm,
    VRMHumanBoneName.Chest,
    {
      x: spineEuler.x * CHEST_SHARE,
      y: spineEuler.y * CHEST_SHARE,
      z: spineEuler.z * CHEST_SHARE,
    },
    dtAlpha(SLERP_SPINE, delta),
  );

  applyArm(
    vrm,
    pose.leftUpperArm,
    pose.leftLowerArm,
    pose.armsVisible.left,
    VRMHumanBoneName.LeftUpperArm,
    VRMHumanBoneName.LeftLowerArm,
    REST_LEFT_UPPER_ARM,
    delta,
  );
  applyArm(
    vrm,
    pose.rightUpperArm,
    pose.rightLowerArm,
    pose.armsVisible.right,
    VRMHumanBoneName.RightUpperArm,
    VRMHumanBoneName.RightLowerArm,
    REST_RIGHT_UPPER_ARM,
    delta,
  );

  if (legsEnabled) {
    applyLeg(
      vrm,
      pose.leftUpperLeg,
      pose.leftLowerLeg,
      pose.legsVisible.left,
      VRMHumanBoneName.LeftUpperLeg,
      VRMHumanBoneName.LeftLowerLeg,
      delta,
    );
    applyLeg(
      vrm,
      pose.rightUpperLeg,
      pose.rightLowerLeg,
      pose.legsVisible.right,
      VRMHumanBoneName.RightUpperLeg,
      VRMHumanBoneName.RightLowerLeg,
      delta,
    );
  } else {
    applyLegRestPose(vrm, delta);
  }
}

function applyHips(vrm: VRM, rotation: Vec3, mirror: boolean, delta: number): void {
  const hx = Math.abs(rotation.x) < HIPS_DEAD_ZONE ? 0 : rotation.x;
  const hy = Math.abs(rotation.y) < HIPS_DEAD_ZONE ? 0 : rotation.y;
  const hz = Math.abs(rotation.z) < HIPS_DEAD_ZONE ? 0 : rotation.z;
  applyEulerToBone(
    vrm,
    VRMHumanBoneName.Hips,
    {
      x: hx * HIPS_DAMPENER,
      y: hy * HIPS_DAMPENER * (mirror ? -1 : 1),
      z: hz * HIPS_DAMPENER * (mirror ? -1 : 1),
    },
    dtAlpha(SLERP_HIPS, delta),
  );
}

function applyLeg(
  vrm: VRM,
  upper: Vec3 | null,
  lower: Vec3 | null,
  visible: boolean,
  upperBoneName: VRMHumanBoneName,
  lowerBoneName: VRMHumanBoneName,
  delta: number,
): void {
  if (!visible || !upper || !lower) {
    slerpBoneToQuat(vrm, upperBoneName, REST_LEG, dtAlpha(SLERP_REST, delta));
    slerpBoneToQuat(vrm, lowerBoneName, REST_LEG, dtAlpha(SLERP_REST, delta));
    return;
  }
  applyEulerToBone(vrm, upperBoneName, clampLegEuler(upper), dtAlpha(SLERP_LEG, delta));
  applyEulerToBone(vrm, lowerBoneName, clampLegEuler(lower), dtAlpha(SLERP_LEG, delta));
}

function clampLegEuler(euler: Vec3): Vec3 {
  return {
    x: THREE.MathUtils.clamp(euler.x * LEG_DAMPENER, -LEG_MAX_RAD, LEG_MAX_RAD),
    y: THREE.MathUtils.clamp(euler.y * LEG_DAMPENER, -1.2, 1.2),
    z: THREE.MathUtils.clamp(euler.z * LEG_DAMPENER, -1.2, 1.2),
  };
}

export function applyLegRestPose(vrm: VRM, delta = 1 / 60): void {
  const a = dtAlpha(SLERP_REST, delta);
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftUpperLeg, REST_LEG, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightUpperLeg, REST_LEG, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftLowerLeg, REST_LEG, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightLowerLeg, REST_LEG, a);
}

function applyArm(
  vrm: VRM,
  upper: Vec3,
  lower: Vec3,
  visible: boolean,
  upperBoneName: VRMHumanBoneName,
  lowerBoneName: VRMHumanBoneName,
  restUpper: THREE.Quaternion,
  delta: number,
): void {
  if (!visible) {
    slerpBoneToQuat(vrm, upperBoneName, restUpper, dtAlpha(SLERP_REST, delta));
    slerpBoneToQuat(vrm, lowerBoneName, REST_LOWER_ARM, dtAlpha(SLERP_REST, delta));
    return;
  }
  applyEulerToBone(
    vrm,
    upperBoneName,
    { x: upper.x * ARM_DAMPENER, y: upper.y * ARM_DAMPENER, z: upper.z * ARM_DAMPENER },
    dtAlpha(SLERP_ARM, delta),
  );
  applyEulerToBone(
    vrm,
    lowerBoneName,
    { x: lower.x * ARM_DAMPENER, y: lower.y * ARM_DAMPENER, z: lower.z * ARM_DAMPENER },
    dtAlpha(SLERP_ARM, delta),
  );
}

export function applyArmRestPose(vrm: VRM, delta = 1 / 60): void {
  const a = dtAlpha(SLERP_REST, delta);
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftUpperArm, REST_LEFT_UPPER_ARM, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightUpperArm, REST_RIGHT_UPPER_ARM, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftLowerArm, REST_LOWER_ARM, a);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightLowerArm, REST_LOWER_ARM, a);
}
