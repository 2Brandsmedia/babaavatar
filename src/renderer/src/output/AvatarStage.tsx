import { memo, useEffect, useRef, useState } from 'react';
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
import { api } from '@renderer/lib/ipc/api';
import {
  getCurrentExpression,
  triggerExpression,
} from '@renderer/lib/expression/expression-bus';
import { applyColliderMultiplier, resetCache } from '@renderer/lib/avatar/collider-tuning';
import type { ExpressionHotkey, GestureName } from '@shared/types';

const BASE_CAM_Y = 1.3;
const BASE_CAM_Z = 2.6;
const BASE_LOOK_Y = 1.0;
const X_FOLLOW = 0.18;
const POS_CLAMP_X = 0.12;
const SCENE_LERP = 0.55;
const DEAD_ZONE = 0.008;

const ORIGIN_VEC = new THREE.Vector3(0, 0, 0);
const SCENE_TARGET = new THREE.Vector3();

function logVrmCapabilities(vrm: VRM): void {
  const manager = vrm.expressionManager;
  if (!manager) {
    console.warn('[VRM-Capability] Avatar hat KEINEN ExpressionManager — keine BlendShapes möglich');
    return;
  }
  const names = manager.expressions.map((e) => e.expressionName).sort();
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const arkitMarkers = ['eyeblinkleft', 'jawopen', 'mouthsmileleft', 'browinnerup'];
  const hasArkit = arkitMarkers.filter((n) => lower.has(n)).length;
  const legacyMarkers = ['blink', 'happy', 'aa', 'a'];
  const hasLegacy = legacyMarkers.filter((n) => lower.has(n)).length;
  console.warn(
    `[VRM-Capability] ${names.length} Expressions: ARKit-Marker: ${hasArkit}/4 (case-insensitive), Legacy-Marker: ${hasLegacy}/4.`,
  );
}

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
    let lastColliderMultiplier = Number.NaN;
    const unsubscribeSettings = settingsChannel.subscribe((settings) => {
      settingsRef.current = settings;
      const multiplier = settings.springBoneColliderMultiplier;
      const loaded = loadedRef.current;
      if (loaded && multiplier !== lastColliderMultiplier) {
        applyColliderMultiplier(loaded.vrm, multiplier);
        lastColliderMultiplier = multiplier;
      }
    });
    settingsChannel.sendRequest();
    const settingsRetry = window.setInterval(() => {
      if (!settingsRef.current) settingsChannel.sendRequest();
    }, 800);
    const stopSettingsRetry = window.setTimeout(() => window.clearInterval(settingsRetry), 12000);

    const handledGestureKeys = new Set<string>();
    const unsubscribeHotkey = api.on<ExpressionHotkey>(api.ipcChannels.HOTKEY_TRIGGERED, (h) => {
      triggerExpression(h.expressionName, { source: 'hotkey' });
    });

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
          if (pose.gestures && settings?.gestureMappings) {
            for (const g of pose.gestures) {
              const key = `${g.name}:${pose.timestamp}`;
              if (!g.justTriggered || handledGestureKeys.has(key)) continue;
              handledGestureKeys.add(key);
              if (handledGestureKeys.size > 64) {
                const first = handledGestureKeys.values().next().value as string | undefined;
                if (first) handledGestureKeys.delete(first);
              }
              const mapping = settings.gestureMappings[g.name as GestureName];
              if (mapping && mapping.type === 'expression') {
                triggerExpression(mapping.name, {
                  source: 'gesture',
                  durationMs: mapping.durationMs,
                });
              }
            }
          }
          const expression = getCurrentExpression(now);
          const poseWithExpression = expression
            ? { ...pose, expression }
            : { ...pose, expression: null };
          const audioVolume = pose.audioPhonemes
            ? Math.max(
                pose.audioPhonemes.A,
                pose.audioPhonemes.I,
                pose.audioPhonemes.U,
                pose.audioPhonemes.E,
                pose.audioPhonemes.O,
              )
            : 0;
          applyPoseToVrm(loaded.vrm, poseWithExpression, {
            mirror: mirrorRef.current,
            lipsyncFromCamera: settings?.lipsyncFromCamera ?? true,
            lipsyncFromMic: settings?.lipsyncFromMic ?? true,
            armIkEnabled: settings?.armIkEnabled ?? true,
            handTrackingEnabled: settings?.handTrackingEnabled ?? true,
            audioVolume,
          });
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
      frameCounterRef.current += 1;
    };
    tick();

    return () => {
      cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', handleResize);
      window.clearInterval(settingsRetry);
      window.clearTimeout(stopSettingsRetry);
      unsubscribePose();
      unsubscribeSettings();
      unsubscribeHotkey();
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
          resetCache(loadedRef.current.vrm);
          disposeVrm(loadedRef.current);
        }
        sceneCtx.scene.add(loaded.scene);
        loaded.scene.position.set(0, 0, 0);
        loaded.scene.rotation.set(0, Math.PI, 0);
        resetIdle(loaded.vrm);
        applyRestArms(loaded.vrm);
        const multiplier = settingsRef.current?.springBoneColliderMultiplier ?? 1;
        applyColliderMultiplier(loaded.vrm, multiplier);
        loaded.vrm.update(0);
        loadedRef.current = loaded;
        logVrmCapabilities(loaded.vrm);
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

  const [hintVisible, setHintVisible] = useState(true);
  const [stats, setStats] = useState<{ fps: number; triangles: number; calls: number; heapMb: number }>({
    fps: 0,
    triangles: 0,
    calls: 0,
    heapMb: 0,
  });
  useEffect(() => {
    const t = window.setTimeout(() => setHintVisible(false), 4000);
    return () => window.clearTimeout(t);
  }, []);

  const frameCounterRef = useRef(0);
  useEffect(() => {
    let lastSample = performance.now();
    const handle = window.setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - lastSample) / 1000;
      const fps = elapsedSec > 0 ? frameCounterRef.current / elapsedSec : 0;
      frameCounterRef.current = 0;
      lastSample = now;
      const info = sceneRef.current?.renderer.info.render;
      type PerfMemory = { usedJSHeapSize: number };
      const memory = (performance as Performance & { memory?: PerfMemory }).memory;
      const heapMb = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
      setStats({
        fps: Math.round(fps),
        triangles: info?.triangles ?? 0,
        calls: info?.calls ?? 0,
        heapMb: Math.round(heapMb),
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, []);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const s = settingsRef.current;
    if (!s) return;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const next = clamp(s.cameraZoom + delta, 0.5, 3.0);
    settingsRef.current = { ...s, cameraZoom: next };
    void api.settings.set('cameraZoom', next).catch(() => undefined);
    setHintVisible(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (e.button !== 0) return;
    const s = settingsRef.current;
    if (!s) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: s.cameraOffsetX,
      startOffsetY: s.cameraOffsetY,
    };
    setHintVisible(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const d = dragRef.current;
    const s = settingsRef.current;
    if (!d?.active || !s) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const dx = ((e.clientX - d.startX) / w) * 2;
    const dy = ((e.clientY - d.startY) / h) * -2;
    const nextX = clamp(d.startOffsetX + dx, -1, 1);
    const nextY = clamp(d.startOffsetY + dy, -1, 1);
    settingsRef.current = { ...s, cameraOffsetX: nextX, cameraOffsetY: nextY };
  };

  const handleMouseUp = (): void => {
    const d = dragRef.current;
    const s = settingsRef.current;
    if (d?.active && s) {
      void api.settings.set('cameraOffsetX', s.cameraOffsetX).catch(() => undefined);
      void api.settings.set('cameraOffsetY', s.cameraOffsetY).catch(() => undefined);
    }
    dragRef.current = null;
  };

  const handleDoubleClick = (): void => {
    settingsRef.current = settingsRef.current
      ? { ...settingsRef.current, cameraZoom: 1, cameraOffsetX: 0, cameraOffsetY: 0 }
      : settingsRef.current;
    void api.settings.set('cameraZoom', 1).catch(() => undefined);
    void api.settings.set('cameraOffsetX', 0).catch(() => undefined);
    void api.settings.set('cameraOffsetY', 0).catch(() => undefined);
    setHintVisible(true);
    window.setTimeout(() => setHintVisible(false), 2500);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
          cursor: 'grab',
        }}
      />
      {hintVisible && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 20,
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontFamily: '-apple-system, Segoe UI, sans-serif',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          Mausrad = Zoom · Ziehen = Position · Doppelklick = Reset
        </div>
      )}
      {settingsRef.current?.showPerformanceStats && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(0,0,0,0.6)',
            color: '#7af2c5',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            lineHeight: 1.5,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div>FPS: {stats.fps}</div>
          <div>Triangles: {stats.triangles.toLocaleString()}</div>
          <div>Draw Calls: {stats.calls}</div>
          <div>JS Heap: {stats.heapMb} MB</div>
        </div>
      )}
    </>
  );
});
