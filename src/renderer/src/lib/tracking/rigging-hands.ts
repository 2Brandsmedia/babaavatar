import * as Kalidokit from 'kalidokit';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandRig, HandsRig } from '@shared/types';
import { createLogger } from '@renderer/lib/logger';
import { toVec } from './rigging-common';

const log = createLogger('rigging-hands');

export function solveHands(handResult: HandLandmarkerResult, mirror: boolean): HandsRig | null {
  const landmarks = handResult.landmarks ?? [];
  const worldLandmarks = handResult.worldLandmarks ?? [];
  const handednesses = handResult.handednesses ?? [];
  if (landmarks.length === 0) return null;

  let left: HandRig | null = null;
  let right: HandRig | null = null;

  for (let i = 0; i < landmarks.length; i += 1) {
    const lm3d = worldLandmarks[i] ?? landmarks[i];
    if (!lm3d) continue;
    const cameraSide = handednesses[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    const avatarSide: 'Left' | 'Right' = mirror
      ? cameraSide === 'Left'
        ? 'Right'
        : 'Left'
      : cameraSide;
    try {
      const solved = Kalidokit.Hand.solve(lm3d, avatarSide) as
        | Record<string, { x: number; y: number; z: number }>
        | undefined;
      if (!solved) continue;
      const rig = buildHandRig(solved, avatarSide);
      if (avatarSide === 'Left') left = rig;
      else right = rig;
    } catch (err) {
      log.warn('Hand-Solver fehlgeschlagen', err);
    }
  }

  if (!left && !right) return null;
  return { left, right };
}

function buildHandRig(
  solved: Record<string, { x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
): HandRig {
  return {
    wrist: toVec(solved[`${side}Wrist`]),
    thumb: {
      proximal: toVec(solved[`${side}ThumbProximal`]),
      intermediate: toVec(solved[`${side}ThumbIntermediate`]),
      distal: toVec(solved[`${side}ThumbDistal`]),
    },
    index: {
      proximal: toVec(solved[`${side}IndexProximal`]),
      intermediate: toVec(solved[`${side}IndexIntermediate`]),
      distal: toVec(solved[`${side}IndexDistal`]),
    },
    middle: {
      proximal: toVec(solved[`${side}MiddleProximal`]),
      intermediate: toVec(solved[`${side}MiddleIntermediate`]),
      distal: toVec(solved[`${side}MiddleDistal`]),
    },
    ring: {
      proximal: toVec(solved[`${side}RingProximal`]),
      intermediate: toVec(solved[`${side}RingIntermediate`]),
      distal: toVec(solved[`${side}RingDistal`]),
    },
    little: {
      proximal: toVec(solved[`${side}LittleProximal`]),
      intermediate: toVec(solved[`${side}LittleIntermediate`]),
      distal: toVec(solved[`${side}LittleDistal`]),
    },
  };
}
