import { memo, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { drawFace, drawHand, drawPose } from './skeleton-renderers';

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
