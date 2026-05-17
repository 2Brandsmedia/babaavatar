import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { PoseFrame, Vec3 } from '@shared/types';
import { REST_LEFT_UPPER_ARM, REST_RIGHT_UPPER_ARM, REST_LOWER_ARM } from './rest-pose';
import { applyEulerToBone, slerpBoneToQuat } from './vrm-shared';

const SLERP_SPINE = 0.4;
const SLERP_ARM = 0.65;
const SLERP_REST = 0.08;
const SPINE_DAMPENER = 0.2;
const ARM_DAMPENER = 1.0;
const SPINE_DEAD_ZONE = 0.05;

export function applyPose(vrm: VRM, frame: PoseFrame, mirror: boolean): void {
  const pose = frame.pose;
  if (!pose) {
    applyArmRestPose(vrm);
    return;
  }

  const sx = Math.abs(pose.spine.x) < SPINE_DEAD_ZONE ? 0 : pose.spine.x;
  const sy = Math.abs(pose.spine.y) < SPINE_DEAD_ZONE ? 0 : pose.spine.y;
  const sz = Math.abs(pose.spine.z) < SPINE_DEAD_ZONE ? 0 : pose.spine.z;

  applyEulerToBone(
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
  if (!visible) {
    slerpBoneToQuat(vrm, upperBoneName, restUpper, SLERP_REST);
    slerpBoneToQuat(vrm, lowerBoneName, REST_LOWER_ARM, SLERP_REST);
    return;
  }
  applyEulerToBone(
    vrm,
    upperBoneName,
    { x: upper.x * ARM_DAMPENER, y: upper.y * ARM_DAMPENER, z: upper.z * ARM_DAMPENER },
    SLERP_ARM,
  );
  applyEulerToBone(
    vrm,
    lowerBoneName,
    { x: lower.x * ARM_DAMPENER, y: lower.y * ARM_DAMPENER, z: lower.z * ARM_DAMPENER },
    SLERP_ARM,
  );
}

export function applyArmRestPose(vrm: VRM): void {
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftUpperArm, REST_LEFT_UPPER_ARM, SLERP_REST);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightUpperArm, REST_RIGHT_UPPER_ARM, SLERP_REST);
  slerpBoneToQuat(vrm, VRMHumanBoneName.LeftLowerArm, REST_LOWER_ARM, SLERP_REST);
  slerpBoneToQuat(vrm, VRMHumanBoneName.RightLowerArm, REST_LOWER_ARM, SLERP_REST);
}
