import * as THREE from 'three';
import type { AppSettings, PoseFrame } from '@shared/types';
import { kalmanStep, type KalmanState } from '@renderer/lib/tracking/iris-distance';

const BASE_CAM_Y = 1.3;
const BASE_CAM_Z = 2.6;
const BASE_LOOK_Y = 1.0;
const X_FOLLOW = 0.18;
const POS_CLAMP_X = 0.12;
const SCENE_LERP = 0.55;
const DEAD_ZONE = 0.008;

const ORIGIN_VEC = new THREE.Vector3(0, 0, 0);
const SCENE_TARGET = new THREE.Vector3();

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function applyDeadZone(value: number, threshold: number): number {
  if (Math.abs(value) < threshold) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (Math.abs(value) - threshold);
}

export function applyAvatarMicroFollow(scene: THREE.Group, pose: PoseFrame): void {
  const metrics = pose.faceMetrics;
  const quality = pose.quality;
  if (!metrics || !quality?.bootstrapped) {
    scene.position.lerp(ORIGIN_VEC, SCENE_LERP * 0.5);
    return;
  }
  const relX = applyDeadZone(metrics.relativeCenterX, DEAD_ZONE);
  const offsetX = clamp(relX * X_FOLLOW, -POS_CLAMP_X, POS_CLAMP_X);
  SCENE_TARGET.set(offsetX, 0, 0);
  scene.position.lerp(SCENE_TARGET, SCENE_LERP);
}

export function resetSceneToOrigin(scene: THREE.Group): void {
  scene.position.lerp(ORIGIN_VEC, SCENE_LERP * 0.5);
}

export function applyCameraComposition(
  camera: THREE.PerspectiveCamera,
  settings: AppSettings,
  pose: PoseFrame | null,
  kalman: KalmanState,
  dt: number,
): void {
  let effectiveZoom = clamp(settings.cameraZoom, 0.5, 3.0);

  if (settings.autoZoomEnabled && pose?.irisDistanceCm) {
    const rawAuto = settings.autoZoomRefDistance / pose.irisDistanceCm;
    const clampedAuto = clamp(rawAuto, settings.autoZoomMin, settings.autoZoomMax);
    kalmanStep(kalman, clampedAuto, dt);
    const deadZoneOut = Math.abs(kalman.x - 1) < 0.04 ? 1 : kalman.x;
    effectiveZoom *= deadZoneOut;
  }

  const offsetX = clamp(settings.cameraOffsetX, -1, 1);
  const offsetY = clamp(settings.cameraOffsetY, -1, 1);

  camera.position.set(offsetX, BASE_CAM_Y + offsetY, BASE_CAM_Z);
  camera.lookAt(offsetX, BASE_LOOK_Y + offsetY, 0);
  if (camera.zoom !== effectiveZoom) {
    camera.zoom = effectiveZoom;
    camera.updateProjectionMatrix();
  }
}
