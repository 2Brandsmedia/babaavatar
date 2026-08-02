import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { HandFingerRig, HandRig, PoseFrame } from '@shared/types';
import { applyEulerToBone, dtAlpha } from './vrm-shared';

const FINGER_SLERP = 0.6;

type FingerName = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Little';

export function applyHands(vrm: VRM, frame: PoseFrame, delta: number): void {
  const hands = frame.hands;
  if (!hands) return;
  if (hands.left) applyHand(vrm, hands.left, 'Left', delta);
  if (hands.right) applyHand(vrm, hands.right, 'Right', delta);
}

function applyHand(vrm: VRM, hand: HandRig, side: 'Left' | 'Right', delta: number): void {
  const slerp = dtAlpha(FINGER_SLERP, delta);
  const fingers: Array<[FingerName, HandFingerRig]> = [
    ['Thumb', hand.thumb],
    ['Index', hand.index],
    ['Middle', hand.middle],
    ['Ring', hand.ring],
    ['Little', hand.little],
  ];
  for (const [name, finger] of fingers) {
    applyEulerToBone(vrm, `${side}${name}Proximal` as VRMHumanBoneName, finger.proximal, slerp);
    applyEulerToBone(
      vrm,
      `${side}${name}Intermediate` as VRMHumanBoneName,
      finger.intermediate,
      slerp,
    );
    applyEulerToBone(vrm, `${side}${name}Distal` as VRMHumanBoneName, finger.distal, slerp);
  }
}
