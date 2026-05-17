import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';
import type { HandFingerRig, HandRig, PoseFrame } from '@shared/types';
import { applyEulerToBone } from './vrm-shared';

const FINGER_SLERP = 0.6;

type FingerName = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Little';

export function applyHands(vrm: VRM, frame: PoseFrame): void {
  const hands = frame.hands;
  if (!hands) return;
  if (hands.left) applyHand(vrm, hands.left, 'Left');
  if (hands.right) applyHand(vrm, hands.right, 'Right');
}

function applyHand(vrm: VRM, hand: HandRig, side: 'Left' | 'Right'): void {
  const fingers: Array<[FingerName, HandFingerRig]> = [
    ['Thumb', hand.thumb],
    ['Index', hand.index],
    ['Middle', hand.middle],
    ['Ring', hand.ring],
    ['Little', hand.little],
  ];
  for (const [name, finger] of fingers) {
    applyEulerToBone(vrm, `${side}${name}Proximal` as VRMHumanBoneName, finger.proximal, FINGER_SLERP);
    applyEulerToBone(
      vrm,
      `${side}${name}Intermediate` as VRMHumanBoneName,
      finger.intermediate,
      FINGER_SLERP,
    );
    applyEulerToBone(vrm, `${side}${name}Distal` as VRMHumanBoneName, finger.distal, FINGER_SLERP);
  }
}
