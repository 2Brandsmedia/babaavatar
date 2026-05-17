import type {
  FaceLandmarkerResult,
  HandLandmarkerResult,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { Vec3 } from '@shared/types';
import type { AutoCalibration } from './auto-calibration';

export const SHOULDER_ELBOW_MIN = 0.55;
export const WRIST_MIN = 0.45;
export const FACE_BASELINE_WIDTH = 0.22;
export const POSE_VISIBILITY_KEYPOINTS = [11, 12] as const;

export interface RawTrackingResult {
  face: FaceLandmarkerResult;
  pose: PoseLandmarkerResult;
  hand: HandLandmarkerResult;
}

export interface RiggingContext {
  video: HTMLVideoElement;
  timestamp: number;
  autoCalibration: AutoCalibration;
  mirror: boolean;
}

export function toVec(value: { x: number; y: number; z: number } | undefined): Vec3 {
  if (!value) return { x: 0, y: 0, z: 0 };
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    z: typeof value.z === 'number' ? value.z : 0,
  };
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
