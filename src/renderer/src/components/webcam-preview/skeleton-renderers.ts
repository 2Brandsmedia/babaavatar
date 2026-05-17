import type { RawLandmark } from '@renderer/store/tracking';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  POSE_CONNECTIONS,
  HAND_CONNECTIONS,
  FACE_OVAL,
  FACE_LIPS_OUTER,
  FACE_LIPS_INNER,
  FACE_LEFT_EYE,
  FACE_RIGHT_EYE,
  FACE_LEFT_EYEBROW,
  FACE_RIGHT_EYEBROW,
  FACE_LEFT_IRIS,
  FACE_RIGHT_IRIS,
  FACE_NOSE_BRIDGE,
} from './skeleton-connections';

const FULL_TESSELATION_EDGES: ReadonlyArray<readonly [number, number]> =
  FaceLandmarker.FACE_LANDMARKS_TESSELATION.map((c) => [c.start, c.end] as const);

export function projectX(x: number, width: number, mirror: boolean): number {
  return mirror ? (1 - x) * width : x * width;
}

export function drawPose(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  width: number,
  height: number,
  mirror: boolean,
): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(122, 242, 197, 0.85)';
  ctx.beginPath();
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    if ((la.visibility ?? 0) < 0.55 || (lb.visibility ?? 0) < 0.55) continue;
    ctx.moveTo(projectX(la.x, width, mirror), la.y * height);
    ctx.lineTo(projectX(lb.x, width, mirror), lb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(122, 242, 197, 0.95)';
  for (let i = 0; i < landmarks.length; i += 1) {
    const lm = landmarks[i];
    if (!lm) continue;
    if ((lm.visibility ?? 0) < 0.55) continue;
    ctx.beginPath();
    ctx.arc(projectX(lm.x, width, mirror), lm.y * height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFace(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  width: number,
  height: number,
  mirror: boolean,
): void {
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(122, 242, 197, 0.55)';
  ctx.beginPath();
  for (const [a, b] of FULL_TESSELATION_EDGES) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.moveTo(projectX(la.x, width, mirror), la.y * height);
    ctx.lineTo(projectX(lb.x, width, mirror), lb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(122, 167, 255, 0.55)';
  for (let i = 0; i < landmarks.length; i += 1) {
    const lm = landmarks[i];
    if (!lm) continue;
    ctx.beginPath();
    ctx.arc(projectX(lm.x, width, mirror), lm.y * height, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(122, 167, 255, 0.85)';
  drawPolyline(ctx, landmarks, FACE_OVAL, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_NOSE_BRIDGE, width, height, mirror);

  ctx.strokeStyle = 'rgba(255, 207, 110, 0.9)';
  drawPolyline(ctx, landmarks, FACE_LIPS_OUTER, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_LIPS_INNER, width, height, mirror);

  ctx.strokeStyle = 'rgba(122, 167, 255, 0.95)';
  drawPolyline(ctx, landmarks, FACE_LEFT_EYE, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_RIGHT_EYE, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_LEFT_EYEBROW, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_RIGHT_EYEBROW, width, height, mirror);

  ctx.strokeStyle = 'rgba(255, 138, 220, 0.95)';
  drawPolyline(ctx, landmarks, FACE_LEFT_IRIS, width, height, mirror);
  drawPolyline(ctx, landmarks, FACE_RIGHT_IRIS, width, height, mirror);
}

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  indices: ReadonlyArray<number>,
  width: number,
  height: number,
  mirror: boolean,
): void {
  ctx.beginPath();
  for (let i = 0; i < indices.length; i += 1) {
    const idx = indices[i];
    if (idx === undefined) continue;
    const lm = landmarks[idx];
    if (!lm) continue;
    const px = projectX(lm.x, width, mirror);
    const py = lm.y * height;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

export function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  side: 'Left' | 'Right',
  width: number,
  height: number,
  mirror: boolean,
): void {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = side === 'Left' ? 'rgba(255, 120, 200, 0.9)' : 'rgba(255, 200, 120, 0.9)';
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.moveTo(projectX(la.x, width, mirror), la.y * height);
    ctx.lineTo(projectX(lb.x, width, mirror), lb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = side === 'Left' ? 'rgba(255, 120, 200, 0.95)' : 'rgba(255, 200, 120, 0.95)';
  for (const lm of landmarks) {
    if (!lm) continue;
    ctx.beginPath();
    ctx.arc(projectX(lm.x, width, mirror), lm.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
