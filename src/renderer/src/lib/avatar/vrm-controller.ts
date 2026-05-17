import type { VRM } from '@pixiv/three-vrm';
import type { PoseFrame } from '@shared/types';
import { applyArmIK } from './arm-ik';
import { applyAllBlendShapes, resetVrmCapabilityCache } from './vrm-blendshape';
import { applyExpression, applyFace, applyGaze } from './vrm-face';
import { applyHands } from './vrm-hands';
import { applyArmRestPose, applyPose } from './vrm-pose';

const IK_BLEND_FACTOR = 0.5;

export { resetVrmCapabilityCache };

export interface VrmControllerOptions {
  mirror: boolean;
  lipsyncFromCamera: boolean;
  lipsyncFromMic: boolean;
  armIkEnabled: boolean;
  handTrackingEnabled: boolean;
  audioVolume: number;
}

export function applyPoseToVrm(
  vrm: VRM,
  frame: PoseFrame,
  options: VrmControllerOptions,
): void {
  applyFace(vrm, frame, options);
  applyAllBlendShapes(vrm, frame);
  applyGaze(vrm, frame, options.mirror);
  if (options.handTrackingEnabled) {
    applyPose(vrm, frame, options.mirror);
    if (options.armIkEnabled && frame.pose) {
      if (frame.pose.leftArmWorld?.visible) {
        applyArmIK({
          vrm,
          side: 'Left',
          armWorld: frame.pose.leftArmWorld,
          blendFactor: IK_BLEND_FACTOR,
        });
      }
      if (frame.pose.rightArmWorld?.visible) {
        applyArmIK({
          vrm,
          side: 'Right',
          armWorld: frame.pose.rightArmWorld,
          blendFactor: IK_BLEND_FACTOR,
        });
      }
    }
    applyHands(vrm, frame);
  } else {
    applyArmRestPose(vrm);
  }
  applyExpression(vrm, frame);
}
