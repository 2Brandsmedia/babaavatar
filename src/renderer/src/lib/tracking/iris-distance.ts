import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const FACE_HEIGHT_MM = 220;
const DEFAULT_FOV_DEG = 60;
const MIN_DISTANCE_CM = 20;
const MAX_DISTANCE_CM = 200;

const FOREHEAD = 10;
const CHIN = 152;

export interface IrisDistanceOptions {
  imageWidth: number;
  imageHeight: number;
  horizontalFovDeg?: number;
}

export function computeIrisDistanceCm(
  landmarks: NormalizedLandmark[] | undefined,
  options: IrisDistanceOptions,
): number | null {
  if (!landmarks || landmarks.length < 478) return null;
  const fovDeg = options.horizontalFovDeg ?? DEFAULT_FOV_DEG;
  const aspect = options.imageWidth / Math.max(1, options.imageHeight);
  const vFovRad = 2 * Math.atan(Math.tan((fovDeg * Math.PI) / 360) / aspect);
  const focalPxV = options.imageHeight / 2 / Math.tan(vFovRad / 2);

  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];
  if (!forehead || !chin) return null;

  const dy = (chin.y - forehead.y) * options.imageHeight;
  const dx = (chin.x - forehead.x) * options.imageWidth;
  const faceHeightPx = Math.sqrt(dx * dx + dy * dy);
  if (faceHeightPx <= 0) return null;

  const distanceMm = (FACE_HEIGHT_MM * focalPxV) / faceHeightPx;
  const distanceCm = distanceMm / 10;
  if (distanceCm < MIN_DISTANCE_CM || distanceCm > MAX_DISTANCE_CM) return null;
  return distanceCm;
}

export interface KalmanState {
  x: number;
  v: number;
  pXX: number;
  pXV: number;
  pVX: number;
  pVV: number;
  initialized: boolean;
}

export function createKalmanState(): KalmanState {
  return {
    x: 1,
    v: 0,
    pXX: 1,
    pXV: 0,
    pVX: 0,
    pVV: 1,
    initialized: false,
  };
}

const PROCESS_NOISE_X = 0.00008;
const PROCESS_NOISE_V = 0.0008;
const MEASUREMENT_NOISE = 0.08;

export function kalmanStep(state: KalmanState, measurement: number, dt: number): void {
  if (!state.initialized) {
    state.x = measurement;
    state.v = 0;
    state.initialized = true;
    return;
  }

  state.x += state.v * dt;
  state.pXX += dt * (state.pXV + state.pVX) + dt * dt * state.pVV + PROCESS_NOISE_X;
  state.pXV += dt * state.pVV;
  state.pVX += dt * state.pVV;
  state.pVV += PROCESS_NOISE_V;

  const s = state.pXX + MEASUREMENT_NOISE;
  const kX = state.pXX / s;
  const kV = state.pVX / s;

  const innovation = measurement - state.x;
  state.x += kX * innovation;
  state.v += kV * innovation;

  state.pXX -= kX * state.pXX;
  state.pXV -= kX * state.pXV;
  state.pVX -= kV * state.pXX;
  state.pVV -= kV * state.pXV;
}
