import { useEffect, useRef, useState } from 'react';
import type { PoseFrame } from '@shared/types';
import { getTrackingEngine, type TrackingEngine } from './mediapipe-setup';
import { framesToPose, type RawTrackingResult } from './rigging';
import { PoseSmoother } from './pose-smoother';
import { AutoCalibration } from './auto-calibration';
import { HandSmoother } from './hand-smoother';
import { useTrackingStore, type RawLandmark } from '@renderer/store/tracking';

export interface TrackingMetrics {
  fps: number;
  averageLatencyMs: number;
  framesProcessed: number;
  droppedFrames: number;
}

export interface UseTrackingOptions {
  video: HTMLVideoElement | null;
  enabled: boolean;
}

export interface UseTrackingResult {
  metrics: TrackingMetrics;
  pose: PoseFrame | null;
  ready: boolean;
  error: string | null;
}

const TARGET_FRAME_INTERVAL_MS = 1000 / 60;

export function useTracking(options: UseTrackingOptions): UseTrackingResult {
  const { video, enabled } = options;
  const [pose, setPose] = useState<PoseFrame | null>(null);
  const [metrics, setMetrics] = useState<TrackingMetrics>({
    fps: 0,
    averageLatencyMs: 0,
    framesProcessed: 0,
    droppedFrames: 0,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<TrackingEngine | null>(null);

  useEffect(() => {
    if (!enabled || !video) {
      setReady(false);
      return;
    }

    let frameHandle = 0;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let latencyAccumulator = 0;
    let dropped = 0;
    let cancelled = false;

    const smoother = new PoseSmoother(4.0, 0.05);
    const autoCalibration = new AutoCalibration();
    const handSmoother = new HandSmoother();
    setError(null);

    getTrackingEngine()
      .then((engine) => {
        if (cancelled) return;
        engineRef.current = engine;
        setReady(true);
        lastFrameTime = performance.now();

        const tick = (): void => {
          if (cancelled) return;
          frameHandle = requestAnimationFrame(tick);

          if (video.readyState < 2) {
            dropped += 1;
            return;
          }
          const now = performance.now();
          const sinceLast = now - lastFrameTime;
          if (sinceLast < TARGET_FRAME_INTERVAL_MS - 1) return;

          const start = performance.now();
          try {
            const faceResult = engine.face.detectForVideo(video, now);
            const poseResult = engine.pose.detectForVideo(video, now);
            const handResult = engine.hand.detectForVideo(video, now);
            const raw: RawTrackingResult = { face: faceResult, pose: poseResult, hand: handResult };
            const rawFrame = framesToPose(raw, { video, timestamp: now, autoCalibration });
            const frame = smoother.smooth(rawFrame);
            setPose(frame);
            publishRawLandmarks(faceResult, poseResult, handResult, handSmoother, now);
          } catch (err) {
            dropped += 1;
            console.error('Tracking-Fehler im Frame', err);
          }

          frameCount += 1;
          latencyAccumulator += performance.now() - start;
          lastFrameTime = now;
        };
        tick();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Tracking-Engine konnte nicht starten');
      });

    const metricsInterval = window.setInterval(() => {
      if (cancelled) return;
      const fps = frameCount;
      const avgLatency = frameCount > 0 ? latencyAccumulator / frameCount : 0;
      setMetrics({
        fps,
        averageLatencyMs: avgLatency,
        framesProcessed: frameCount,
        droppedFrames: dropped,
      });
      frameCount = 0;
      latencyAccumulator = 0;
    }, 1000);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      window.clearInterval(metricsInterval);
    };
  }, [video, enabled]);

  return { pose, metrics, ready, error };
}

function publishRawLandmarks(
  faceResult: { faceLandmarks?: RawLandmark[][] },
  poseResult: { landmarks?: RawLandmark[][] },
  handResult: {
    landmarks?: RawLandmark[][];
    handednesses?: Array<Array<{ categoryName?: string }>>;
  },
  handSmoother: HandSmoother,
  timestamp: number,
): void {
  const store = useTrackingStore.getState();
  const face = faceResult.faceLandmarks?.[0] ?? null;
  const pose = poseResult.landmarks?.[0] ?? null;
  const hands: Array<{ landmarks: RawLandmark[]; side: 'Left' | 'Right' }> = [];
  const handLandmarks = handResult.landmarks ?? [];
  const handedness = handResult.handednesses ?? [];
  for (let i = 0; i < handLandmarks.length; i += 1) {
    const lm = handLandmarks[i];
    const sideName = handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    if (lm) hands.push({ landmarks: lm, side: sideName });
  }
  const smoothedHands = handSmoother.smooth(hands, timestamp);
  store.setRawLandmarks({ face, pose, hands: smoothedHands });
}
