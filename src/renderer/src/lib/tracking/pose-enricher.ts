import type { AppSettings, PoseFrame, VmcSnapshot } from '@shared/types';
import { mergeVmcIntoPose } from './vmc-merge';

interface AudioPhonemes {
  A: number;
  I: number;
  U: number;
  E: number;
  O: number;
}

interface LipsyncSnapshot {
  ready: boolean;
  phonemes: { a: number; i: number; u: number; e: number; o: number };
}

const VMC_FRESHNESS_MS = 2000;

export function buildAudioPhonemes(lipsync: LipsyncSnapshot): AudioPhonemes | null {
  if (!lipsync.ready) return null;
  return {
    A: lipsync.phonemes.a,
    I: lipsync.phonemes.i,
    U: lipsync.phonemes.u,
    E: lipsync.phonemes.e,
    O: lipsync.phonemes.o,
  };
}

export function enrichTrackingFrame(
  pose: PoseFrame,
  audioPhonemes: AudioPhonemes | null,
  settings: AppSettings | null,
  vmc: VmcSnapshot | null,
): PoseFrame {
  let enriched: PoseFrame = { ...pose, audioPhonemes };
  if (settings?.vmcEnabled && vmc && Date.now() - vmc.receivedAt < VMC_FRESHNESS_MS) {
    enriched = mergeVmcIntoPose(enriched, vmc, {
      applyFace: settings.vmcSourceFace,
      applyHead: settings.vmcSourceHead,
    });
  }
  return enriched;
}

export function buildVmcOnlyFrame(
  vmc: VmcSnapshot,
  audioPhonemes: AudioPhonemes | null,
  settings: AppSettings,
): PoseFrame {
  const base: PoseFrame = {
    timestamp: performance.now(),
    face: {
      head: { x: 0, y: 0, z: 0 },
      eyeL: 1,
      eyeR: 1,
      brow: 0,
      pupilX: 0,
      pupilY: 0,
      gazeX: 0,
      gazeY: 0,
      mouth: { A: 0, I: 0, U: 0, E: 0, O: 0, smile: 0 },
    },
    pose: null,
    hands: null,
    gestures: null,
    faceMetrics: null,
    irisDistanceCm: null,
    blendShapes: null,
    quality: null,
    audioPhonemes,
    expression: null,
  };
  return mergeVmcIntoPose(base, vmc, {
    applyFace: settings.vmcSourceFace,
    applyHead: settings.vmcSourceHead,
  });
}
