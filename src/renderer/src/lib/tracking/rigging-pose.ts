import * as Kalidokit from 'kalidokit';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { ArmWorldPoints, PoseRig, Vec3 } from '@shared/types';
import { createLogger } from '@renderer/lib/logger';
import { POSE_VISIBILITY_KEYPOINTS, SHOULDER_ELBOW_MIN, WRIST_MIN, toVec } from './rigging-common';

const log = createLogger('rigging-pose');

export function solvePose(
  result: PoseLandmarkerResult,
  video: HTMLVideoElement,
  mirror: boolean,
): PoseRig | null {
  const landmarks2d = result.landmarks?.[0];
  const landmarks3d = result.worldLandmarks?.[0];
  if (!landmarks2d || !landmarks3d) return null;
  try {
    const solved = Kalidokit.Pose.solve(landmarks3d, landmarks2d, {
      runtime: 'mediapipe',
      video,
      enableLegs: false,
    });
    if (!solved) return null;

    const armsVisible = computeArmVisibility(landmarks3d, mirror);

    const leftUpper = mirror ? solved.RightUpperArm : solved.LeftUpperArm;
    const leftLower = mirror ? solved.RightLowerArm : solved.LeftLowerArm;
    const rightUpper = mirror ? solved.LeftUpperArm : solved.RightUpperArm;
    const rightLower = mirror ? solved.LeftLowerArm : solved.RightLowerArm;

    const leftArmWorld = buildArmWorld(
      landmarks3d,
      mirror ? 'cam-right' : 'cam-left',
      mirror,
      armsVisible.left,
    );
    const rightArmWorld = buildArmWorld(
      landmarks3d,
      mirror ? 'cam-left' : 'cam-right',
      mirror,
      armsVisible.right,
    );

    return {
      spine: toVec(solved.Spine),
      leftUpperArm: toVec(leftUpper),
      leftLowerArm: toVec(leftLower),
      rightUpperArm: toVec(rightUpper),
      rightLowerArm: toVec(rightLower),
      hipsPosition: toVec(solved.Hips.position),
      hipsWorldPosition: toVec(solved.Hips.worldPosition ?? { x: 0, y: 0, z: 0 }),
      hipsRotation: toVec(solved.Hips.rotation ?? { x: 0, y: 0, z: 0 }),
      armsVisible,
      leftArmWorld,
      rightArmWorld,
    };
  } catch (err) {
    log.warn('Pose-Solver fehlgeschlagen', err);
    return null;
  }
}

export function computePoseVisibilityAverage(result: PoseLandmarkerResult): number {
  const landmarks = result.landmarks?.[0];
  if (!landmarks || landmarks.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const idx of POSE_VISIBILITY_KEYPOINTS) {
    const lm = landmarks[idx];
    if (lm && typeof lm.visibility === 'number') {
      sum += lm.visibility;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function buildArmWorld(
  landmarks3d: ReadonlyArray<{ x?: number; y?: number; z?: number; visibility?: number }>,
  camSide: 'cam-left' | 'cam-right',
  mirror: boolean,
  visible: boolean,
): ArmWorldPoints | null {
  const shoulderIdx = camSide === 'cam-left' ? 11 : 12;
  const elbowIdx = camSide === 'cam-left' ? 13 : 14;
  const wristIdx = camSide === 'cam-left' ? 15 : 16;

  const s = landmarks3d[shoulderIdx];
  const e = landmarks3d[elbowIdx];
  const w = landmarks3d[wristIdx];
  if (!s || !e || !w) return null;

  return {
    shoulder: mpToThree(s, mirror),
    elbow: mpToThree(e, mirror),
    wrist: mpToThree(w, mirror),
    visible,
  };
}

function mpToThree(lm: { x?: number; y?: number; z?: number }, mirror: boolean): Vec3 {
  const x = typeof lm.x === 'number' ? lm.x : 0;
  const y = typeof lm.y === 'number' ? lm.y : 0;
  const z = typeof lm.z === 'number' ? lm.z : 0;
  return {
    x: mirror ? -x : x,
    y: -y,
    z: -z,
  };
}

function computeArmVisibility(
  landmarks: ReadonlyArray<{ visibility?: number }>,
  mirror: boolean,
): { left: boolean; right: boolean } {
  const camLeftShoulder = landmarks[11]?.visibility ?? 0;
  const camLeftElbow = landmarks[13]?.visibility ?? 0;
  const camLeftWrist = landmarks[15]?.visibility ?? 0;
  const camRightShoulder = landmarks[12]?.visibility ?? 0;
  const camRightElbow = landmarks[14]?.visibility ?? 0;
  const camRightWrist = landmarks[16]?.visibility ?? 0;

  const leftShoulder = mirror ? camRightShoulder : camLeftShoulder;
  const leftElbow = mirror ? camRightElbow : camLeftElbow;
  const leftWrist = mirror ? camRightWrist : camLeftWrist;
  const rightShoulder = mirror ? camLeftShoulder : camRightShoulder;
  const rightElbow = mirror ? camLeftElbow : camRightElbow;
  const rightWrist = mirror ? camLeftWrist : camRightWrist;

  return {
    left:
      (leftShoulder >= SHOULDER_ELBOW_MIN && leftElbow >= SHOULDER_ELBOW_MIN) ||
      leftWrist >= WRIST_MIN,
    right:
      (rightShoulder >= SHOULDER_ELBOW_MIN && rightElbow >= SHOULDER_ELBOW_MIN) ||
      rightWrist >= WRIST_MIN,
  };
}
