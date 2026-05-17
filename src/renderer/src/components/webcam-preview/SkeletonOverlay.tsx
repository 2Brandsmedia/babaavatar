import { memo, useEffect, useRef } from 'react';
import { useTrackingStore, type RawLandmark } from '@renderer/store/tracking';
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
  FACE_TESSELATION_EDGES,
} from './skeleton-connections';

interface SkeletonOverlayProps {
  mirror: boolean;
}

export const SkeletonOverlay = memo(function SkeletonOverlay({
  mirror,
}: SkeletonOverlayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawLandmarksRef = useTrackingStore((state) => state.rawLandmarksRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const draw = (): void => {
      raf = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const landmarks = rawLandmarksRef.current;
      if (!landmarks) return;
      if (landmarks.pose) drawPose(ctx, landmarks.pose, rect.width, rect.height, mirror);
      if (landmarks.face) drawFace(ctx, landmarks.face, rect.width, rect.height, mirror);
      for (const hand of landmarks.hands) {
        drawHand(ctx, hand.landmarks, hand.side, rect.width, rect.height, mirror);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [rawLandmarksRef, mirror]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
});

function projectX(x: number, width: number, mirror: boolean): number {
  return mirror ? (1 - x) * width : x * width;
}

function drawPose(
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

function drawFace(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  width: number,
  height: number,
  mirror: boolean,
): void {
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(122, 167, 255, 0.45)';
  ctx.beginPath();
  for (const [a, b] of FACE_TESSELATION_EDGES) {
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

function drawPolyline(
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

function drawHand(
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
