import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AppSettings, PoseFrame } from '@shared/types';
import { createScene, disposeScene, resizeScene, type SceneContext } from '@renderer/lib/three/scene';
import { loadVrmFromUrl, disposeVrm, type LoadedVrm } from '@renderer/lib/avatar/vrm-loader';
import {
  applyIdleAnimation,
  applyRestArms,
  createIdleState,
  resetIdle,
} from '@renderer/lib/avatar/idle-animations';
import { applyPoseToVrm } from '@renderer/lib/avatar/vrm-controller';
import { createPoseChannel } from '@renderer/lib/broadcast/pose-channel';
import { createSettingsChannel } from '@renderer/lib/broadcast/settings-channel';
import { createKalmanState, kalmanStep, type KalmanState } from '@renderer/lib/tracking/iris-distance';

const BASE_CAM_Y = 1.3;
const BASE_CAM_Z = 2.6;
const BASE_LOOK_Y = 1.0;
const X_FOLLOW = 0.18;
const POS_CLAMP_X = 0.12;
const SCENE_LERP = 0.55;
const DEAD_ZONE = 0.008;

const ORIGIN_VEC = new THREE.Vector3(0, 0, 0);
const SCENE_TARGET = new THREE.Vector3();

function applyAvatarMicroFollow(scene: THREE.Group, pose: PoseFrame): void {
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

function applyCameraComposition(
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
    effectiveZoom *= kalman.x;
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

function applyDeadZone(value: number, threshold: number): number {
  if (Math.abs(value) < threshold) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (Math.abs(value) - threshold);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

interface AvatarStageProps {
  background: string;
  vrmUrl: string | null;
  mirror: boolean;
  onLoad?: (vrm: VRM) => void;
  onError?: (error: Error) => void;
}

export const AvatarStage = memo(function AvatarStage({
  background,
  vrmUrl,
  mirror,
  onLoad,
  onError,
}: AvatarStageProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const loadedRef = useRef<LoadedVrm | null>(null);
  const lastPoseRef = useRef<PoseFrame | null>(null);
  const mirrorRef = useRef(mirror);
  const settingsRef = useRef<AppSettings | null>(null);
  const kalmanRef = useRef<KalmanState>(createKalmanState());

  useEffect(() => {
    mirrorRef.current = mirror;
  }, [mirror]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialWidth = canvas.clientWidth || window.innerWidth;
    const initialHeight = canvas.clientHeight || window.innerHeight;
    const sceneCtx = createScene({
      canvas,
      background,
      width: initialWidth,
      height: initialHeight,
    });
    sceneRef.current = sceneCtx;

    const idleState = createIdleState();
    const channel = createPoseChannel();
    const unsubscribePose = channel.subscribe((frame) => {
      lastPoseRef.current = frame;
    });

    const settingsChannel = createSettingsChannel();
    const unsubscribeSettings = settingsChannel.subscribe((settings) => {
      settingsRef.current = settings;
    });
    settingsChannel.sendRequest();
    const settingsRetry = window.setInterval(() => {
      if (!settingsRef.current) settingsChannel.sendRequest();
    }, 800);
    const stopSettingsRetry = window.setTimeout(() => window.clearInterval(settingsRetry), 12000);

    const handleResize = (): void => {
      if (!sceneRef.current) return;
      resizeScene(sceneRef.current, window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let frameHandle = 0;
    const tick = (): void => {
      frameHandle = requestAnimationFrame(tick);
      if (!sceneRef.current) return;
      const delta = sceneRef.current.clock.getDelta();
      const loaded = loadedRef.current;
      const settings = settingsRef.current;

      if (loaded) {
        const pose = lastPoseRef.current;
        const now = performance.now();
        const poseFresh = pose && now - pose.timestamp < 2000;
        if (poseFresh && pose) {
          applyPoseToVrm(loaded.vrm, pose, { mirror: mirrorRef.current });
          applyAvatarMicroFollow(loaded.scene, pose);
        } else {
          applyIdleAnimation(loaded.vrm, idleState, delta);
          loaded.scene.position.lerp(ORIGIN_VEC, SCENE_LERP * 0.5);
        }
        loaded.vrm.update(delta);
      }

      if (settings) {
        applyCameraComposition(
          sceneRef.current.camera,
          settings,
          lastPoseRef.current,
          kalmanRef.current,
          delta,
        );
      }

      sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', handleResize);
      window.clearInterval(settingsRetry);
      window.clearTimeout(stopSettingsRetry);
      unsubscribePose();
      unsubscribeSettings();
      channel.close();
      settingsChannel.close();
      if (loadedRef.current) {
        sceneCtx.scene.remove(loadedRef.current.scene);
        disposeVrm(loadedRef.current);
        loadedRef.current = null;
      }
      disposeScene(sceneCtx);
      sceneRef.current = null;
    };
  }, [background]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const sceneCtx = sceneRef.current;

    if (!vrmUrl) {
      if (loadedRef.current) {
        sceneCtx.scene.remove(loadedRef.current.scene);
        disposeVrm(loadedRef.current);
        loadedRef.current = null;
      }
      return;
    }

    let cancelled = false;
    loadVrmFromUrl(vrmUrl)
      .then((loaded) => {
        if (cancelled) {
          disposeVrm(loaded);
          return;
        }
        if (loadedRef.current) {
          sceneCtx.scene.remove(loadedRef.current.scene);
          disposeVrm(loadedRef.current);
        }
        sceneCtx.scene.add(loaded.scene);
        loaded.scene.position.set(0, 0, 0);
        loaded.scene.rotation.set(0, Math.PI, 0);
        resetIdle(loaded.vrm);
        applyRestArms(loaded.vrm);
        loaded.vrm.update(0);
        loadedRef.current = loaded;
        onLoad?.(loaded.vrm);
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [vrmUrl, onLoad, onError]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.scene.background = new THREE.Color(background);
  }, [background]);

  return <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />;
});
