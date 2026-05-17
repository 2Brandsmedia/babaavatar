import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AppSettings, ExpressionHotkey, PoseFrame } from '@shared/types';
import { createScene, disposeScene, resizeScene, type SceneContext } from '@renderer/lib/three/scene';
import { loadVrmFromUrl, disposeVrm, type LoadedVrm } from '@renderer/lib/avatar/vrm-loader';
import { applyRestArms, createIdleState, resetIdle } from '@renderer/lib/avatar/idle-animations';
import { createPoseChannel } from '@renderer/lib/broadcast/pose-channel';
import { createSettingsChannel } from '@renderer/lib/broadcast/settings-channel';
import { createKalmanState, type KalmanState } from '@renderer/lib/tracking/iris-distance';
import { api } from '@renderer/lib/ipc/api';
import { triggerExpression } from '@renderer/lib/expression/expression-bus';
import { applyColliderMultiplier, resetCache } from '@renderer/lib/avatar/collider-tuning';
import { createLogger } from '@renderer/lib/logger';
import { runFrame } from './avatar-frame-loop';
import { useAvatarCameraInput } from './avatar-camera-input';
import { StatsOverlay, useRendererStats } from './avatar-stats';

const log = createLogger('avatar-stage');

function logVrmCapabilities(vrm: VRM): void {
  const manager = vrm.expressionManager;
  if (!manager) {
    log.warn('Avatar hat KEINEN ExpressionManager - keine BlendShapes moeglich');
    return;
  }
  const names = manager.expressions.map((e) => e.expressionName).sort();
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const arkitMarkers = ['eyeblinkleft', 'jawopen', 'mouthsmileleft', 'browinnerup'];
  const hasArkit = arkitMarkers.filter((n) => lower.has(n)).length;
  const legacyMarkers = ['blink', 'happy', 'aa', 'a'];
  const hasLegacy = legacyMarkers.filter((n) => lower.has(n)).length;
  log.info('VRM-Capability', {
    expressions: names.length,
    arkitMarkers: `${hasArkit}/4`,
    legacyMarkers: `${hasLegacy}/4`,
  });
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
  const frameCounterRef = useRef(0);

  const cameraInput = useAvatarCameraInput(settingsRef);
  const stats = useRendererStats(sceneRef, frameCounterRef);

  useEffect(() => {
    mirrorRef.current = mirror;
  }, [mirror]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialWidth = canvas.clientWidth || window.innerWidth;
    const initialHeight = canvas.clientHeight || window.innerHeight;
    const sceneCtx = createScene({ canvas, background, width: initialWidth, height: initialHeight });
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
      const ctx = sceneRef.current;
      if (!ctx) return;
      const delta = ctx.clock.getDelta();
      runFrame({
        sceneCtx: ctx,
        loaded: loadedRef.current,
        pose: lastPoseRef.current,
        settings: settingsRef.current,
        mirror: mirrorRef.current,
        idleState,
        kalman: kalmanRef.current,
        delta,
        handledGestureKeys,
      });
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

  useEffect(() => {
    const t = window.setTimeout(() => cameraInput.setHintVisible(false), 4000);
    return () => window.clearTimeout(t);
  }, [cameraInput]);

  const showStats = settingsRef.current?.showPerformanceStats ?? false;

  return (
    <>
      <canvas
        ref={canvasRef}
        onWheel={cameraInput.onWheel}
        onMouseDown={cameraInput.onMouseDown}
        onMouseMove={cameraInput.onMouseMove}
        onMouseUp={cameraInput.onMouseUp}
        onMouseLeave={cameraInput.onMouseUp}
        onDoubleClick={cameraInput.onDoubleClick}
        style={{ width: '100vw', height: '100vh', display: 'block', cursor: 'grab' }}
      />
      {cameraInput.hintVisible && (
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
      {showStats && <StatsOverlay stats={stats} />}
    </>
  );
});
