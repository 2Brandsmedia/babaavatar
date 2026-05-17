import type { AppSettings, GestureName, PoseFrame } from '@shared/types';
import { applyIdleAnimation, type IdleAnimationState } from '@renderer/lib/avatar/idle-animations';
import { applyPoseToVrm } from '@renderer/lib/avatar/vrm-controller';
import { getCurrentExpression, triggerExpression } from '@renderer/lib/expression/expression-bus';
import type { SceneContext } from '@renderer/lib/three/scene';
import type { LoadedVrm } from '@renderer/lib/avatar/vrm-loader';
import type { KalmanState } from '@renderer/lib/tracking/iris-distance';
import {
  applyAvatarMicroFollow,
  applyCameraComposition,
  resetSceneToOrigin,
} from './avatar-camera-control';

const POSE_FRESH_MS = 2000;
const HANDLED_GESTURES_MAX = 64;

export interface FrameLoopOptions {
  sceneCtx: SceneContext;
  loaded: LoadedVrm | null;
  pose: PoseFrame | null;
  settings: AppSettings | null;
  mirror: boolean;
  idleState: IdleAnimationState;
  kalman: KalmanState;
  delta: number;
  handledGestureKeys: Set<string>;
}

export function runFrame(options: FrameLoopOptions): void {
  const { sceneCtx, loaded, pose, settings, mirror, idleState, kalman, delta, handledGestureKeys } =
    options;

  if (loaded) {
    const now = performance.now();
    const poseFresh = pose && now - pose.timestamp < POSE_FRESH_MS;
    if (poseFresh && pose) {
      if (pose.gestures && settings?.gestureMappings) {
        triggerGestureExpressions(pose, settings, handledGestureKeys);
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
        mirror,
        lipsyncFromCamera: settings?.lipsyncFromCamera ?? true,
        lipsyncFromMic: settings?.lipsyncFromMic ?? true,
        armIkEnabled: settings?.armIkEnabled ?? true,
        handTrackingEnabled: settings?.handTrackingEnabled ?? true,
        audioVolume,
      });
      applyAvatarMicroFollow(loaded.scene, pose);
    } else {
      applyIdleAnimation(loaded.vrm, idleState, delta);
      resetSceneToOrigin(loaded.scene);
    }
    loaded.vrm.update(delta);
  }

  if (settings) {
    applyCameraComposition(sceneCtx.camera, settings, pose, kalman, delta);
  }

  sceneCtx.renderer.render(sceneCtx.scene, sceneCtx.camera);
}

function triggerGestureExpressions(
  pose: PoseFrame,
  settings: AppSettings,
  handledGestureKeys: Set<string>,
): void {
  if (!pose.gestures) return;
  for (const g of pose.gestures) {
    const key = `${g.name}:${pose.timestamp}`;
    if (!g.justTriggered || handledGestureKeys.has(key)) continue;
    handledGestureKeys.add(key);
    if (handledGestureKeys.size > HANDLED_GESTURES_MAX) {
      const first = handledGestureKeys.values().next().value as string | undefined;
      if (first) handledGestureKeys.delete(first);
    }
    const mapping = settings.gestureMappings[g.name as GestureName];
    if (mapping && mapping.type === 'expression') {
      triggerExpression(mapping.name, { source: 'gesture', durationMs: mapping.durationMs });
    }
  }
}
