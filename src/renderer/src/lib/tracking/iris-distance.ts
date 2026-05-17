import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const IRIS_DIAMETER_MM = 11.7;
const DEFAULT_FOV_DEG = 60;
const MIN_DISTANCE_CM = 20;
const MAX_DISTANCE_CM = 200;

const LEFT_IRIS_RIGHT_EDGE = 469;
const LEFT_IRIS_LEFT_EDGE = 471;
const RIGHT_IRIS_RIGHT_EDGE = 474;
const RIGHT_IRIS_LEFT_EDGE = 476;

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
  const focalPx = options.imageWidth / 2 / Math.tan((fovDeg * Math.PI) / 360);

  const leftDiameter = irisDiameterPx(landmarks, LEFT_IRIS_LEFT_EDGE, LEFT_IRIS_RIGHT_EDGE, options);
  const rightDiameter = irisDiameterPx(
    landmarks,
    RIGHT_IRIS_LEFT_EDGE,
    RIGHT_IRIS_RIGHT_EDGE,
    options,
  );

  let diameter: number;
  if (leftDiameter !== null && rightDiameter !== null) {
    diameter = (leftDiameter + rightDiameter) / 2;
  } else if (leftDiameter !== null) {
    diameter = leftDiameter;
  } else if (rightDiameter !== null) {
    diameter = rightDiameter;
  } else {
    return null;
  }

  if (diameter <= 0) return null;
  const distanceMm = (IRIS_DIAMETER_MM * focalPx) / diameter;
  const distanceCm = distanceMm / 10;
  if (distanceCm < MIN_DISTANCE_CM || distanceCm > MAX_DISTANCE_CM) return null;
  return distanceCm;
}

function irisDiameterPx(
  landmarks: NormalizedLandmark[],
  leftIdx: number,
  rightIdx: number,
  options: IrisDistanceOptions,
): number | null {
  const a = landmarks[leftIdx];
  const b = landmarks[rightIdx];
  if (!a || !b) return null;
  const dx = (a.x - b.x) * options.imageWidth;
  const dy = (a.y - b.y) * options.imageHeight;
  return Math.sqrt(dx * dx + dy * dy);
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

const PROCESS_NOISE_X = 0.0008;
const PROCESS_NOISE_V = 0.005;
const MEASUREMENT_NOISE = 0.02;

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
