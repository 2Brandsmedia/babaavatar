import * as Kalidokit from 'kalidokit';
import type { Classifications, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { BlendShapeMap, FaceRig } from '@shared/types';
import { createLogger } from '@renderer/lib/logger';
import { clamp, clamp01, toVec } from './rigging-common';

const log = createLogger('rigging-face');

export function solveFace(result: FaceLandmarkerResult, video: HTMLVideoElement): FaceRig | null {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;
  try {
    const solved = Kalidokit.Face.solve(landmarks, {
      runtime: 'mediapipe',
      video,
      smoothBlink: false,
      blinkSettings: [0.25, 0.75],
    });
    if (!solved) return null;
    const gaze = computeIrisGaze(landmarks);
    return {
      head: toVec(solved.head),
      eyeL: clamp01(solved.eye.l),
      eyeR: clamp01(solved.eye.r),
      brow: clamp01(solved.brow),
      pupilX: solved.pupil.x,
      pupilY: solved.pupil.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
      mouth: {
        A: clamp01(solved.mouth.shape.A),
        I: clamp01(solved.mouth.shape.I),
        U: clamp01(solved.mouth.shape.U),
        E: clamp01(solved.mouth.shape.E),
        O: clamp01(solved.mouth.shape.O),
        smile: 0,
      },
    };
  } catch (err) {
    log.warn('Face-Solver fehlgeschlagen', err);
    return null;
  }
}

export function computeFaceRawMetrics(result: FaceLandmarkerResult): {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} | null {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const noseTip = landmarks[1];
  return {
    centerX: noseTip?.x ?? (minX + maxX) / 2,
    centerY: noseTip?.y ?? (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function extractBlendShapes(result: FaceLandmarkerResult): BlendShapeMap | null {
  const list: Classifications[] | undefined = result.faceBlendshapes;
  const first = list?.[0]?.categories;
  if (!first || first.length === 0) return null;
  const map: Record<string, number> = {};
  for (const cat of first) {
    if (cat.categoryName) map[cat.categoryName] = cat.score;
  }
  return map;
}

function computeIrisGaze(
  landmarks: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftTop = landmarks[159];
  const leftBottom = landmarks[145];
  const rightOuter = landmarks[362];
  const rightInner = landmarks[263];
  const rightTop = landmarks[386];
  const rightBottom = landmarks[374];

  if (
    !leftIris ||
    !rightIris ||
    !leftOuter ||
    !leftInner ||
    !leftTop ||
    !leftBottom ||
    !rightOuter ||
    !rightInner ||
    !rightTop ||
    !rightBottom
  ) {
    return { x: 0, y: 0 };
  }

  const lcx = (leftOuter.x + leftInner.x) / 2;
  const lcy = (leftTop.y + leftBottom.y) / 2;
  const lw = Math.abs(leftInner.x - leftOuter.x) / 2 || 0.0001;
  const lh = Math.abs(leftBottom.y - leftTop.y) / 2 || 0.0001;
  const lgx = (leftIris.x - lcx) / lw;
  const lgy = (leftIris.y - lcy) / lh;

  const rcx = (rightOuter.x + rightInner.x) / 2;
  const rcy = (rightTop.y + rightBottom.y) / 2;
  const rw = Math.abs(rightInner.x - rightOuter.x) / 2 || 0.0001;
  const rh = Math.abs(rightBottom.y - rightTop.y) / 2 || 0.0001;
  const rgx = (rightIris.x - rcx) / rw;
  const rgy = (rightIris.y - rcy) / rh;

  return {
    x: clamp((lgx + rgx) / 2, -1, 1),
    y: clamp((lgy + rgy) / 2, -1, 1),
  };
}
