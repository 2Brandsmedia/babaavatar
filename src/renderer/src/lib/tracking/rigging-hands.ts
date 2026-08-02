import * as Kalidokit from 'kalidokit';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandFingerRig, HandRig, HandsRig, Vec3 } from '@shared/types';
import { createLogger } from '@renderer/lib/logger';
import { toVec } from './rigging-common';

const log = createLogger('rigging-hands');

// Anatomische Nachbearbeitung der Kalidokit-Finger-Euler:
// Kalidokit legt die Beugung (Curl) auf die z-Achse, die Spreizung auf y.
const CURL_MAX = 2.2; // ~126° — mehr Beugung liefert eine Webcam nicht glaubwürdig
const THUMB_AXIS_MAX = 1.6;
const OUTLIER_X = Math.PI / 3;
const OUTLIER_Y = Math.PI / 2.5;
const SPLAY_FADE_START = 0.35; // ab dieser Beugung wird Spreizung ausgeblendet …
const SPLAY_FADE_END = Math.PI / 2; // … und hier ist sie komplett weg
const CHAIN_INCONSISTENCY_DAMP = 0.3;

export function solveHands(handResult: HandLandmarkerResult, mirror: boolean): HandsRig | null {
  const landmarks = handResult.landmarks ?? [];
  const worldLandmarks = handResult.worldLandmarks ?? [];
  const handednesses = handResult.handednesses ?? [];
  if (landmarks.length === 0) return null;

  let left: HandRig | null = null;
  let right: HandRig | null = null;

  for (let i = 0; i < landmarks.length; i += 1) {
    const lm3d = worldLandmarks[i] ?? landmarks[i];
    if (!lm3d) continue;
    const cameraSide = handednesses[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    const avatarSide: 'Left' | 'Right' = mirror
      ? cameraSide === 'Left'
        ? 'Right'
        : 'Left'
      : cameraSide;
    try {
      const solved = Kalidokit.Hand.solve(lm3d, avatarSide) as
        | Record<string, { x: number; y: number; z: number }>
        | undefined;
      if (!solved) continue;
      const rig = buildHandRig(solved, avatarSide);
      if (avatarSide === 'Left') left = rig;
      else right = rig;
    } catch (err) {
      log.warn('Hand-Solver fehlgeschlagen', err);
    }
  }

  if (!left && !right) return null;
  return { left, right };
}

function buildHandRig(
  solved: Record<string, { x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
): HandRig {
  return {
    wrist: toVec(solved[`${side}Wrist`]),
    thumb: refineThumb(
      toVec(solved[`${side}ThumbProximal`]),
      toVec(solved[`${side}ThumbIntermediate`]),
      toVec(solved[`${side}ThumbDistal`]),
    ),
    index: refineFinger(
      toVec(solved[`${side}IndexProximal`]),
      toVec(solved[`${side}IndexIntermediate`]),
      toVec(solved[`${side}IndexDistal`]),
    ),
    middle: refineFinger(
      toVec(solved[`${side}MiddleProximal`]),
      toVec(solved[`${side}MiddleIntermediate`]),
      toVec(solved[`${side}MiddleDistal`]),
    ),
    ring: refineFinger(
      toVec(solved[`${side}RingProximal`]),
      toVec(solved[`${side}RingIntermediate`]),
      toVec(solved[`${side}RingDistal`]),
    ),
    little: refineFinger(
      toVec(solved[`${side}LittleProximal`]),
      toVec(solved[`${side}LittleIntermediate`]),
      toVec(solved[`${side}LittleDistal`]),
    ),
  };
}

function refineFinger(proximal: Vec3, intermediate: Vec3, distal: Vec3): HandFingerRig {
  // 1. Grobe Ausreißer auf reine Beugung reduzieren: x/y sollten bei Fingern
  //    nahe 0 liegen — sind sie riesig, ist die Pose-Schätzung gekippt.
  const p = reduceOutlier(proximal);
  const i = reduceOutlier(intermediate);
  const d = reduceOutlier(distal);

  // 2. Spreizung (y am Grundglied) mit der Beugung ausblenden — bei einer Faust
  //    ist der gemessene Spreizwinkel reines Rauschen. Der Rest des y wird
  //    NICHT in Beugung umgewandelt, das wäre bei Kalidokit doppelt gemoppelt.
  const curl = Math.abs(p.z);
  const splayScale =
    1 - clamp01((curl - SPLAY_FADE_START) / (SPLAY_FADE_END - SPLAY_FADE_START));
  const proximalOut: Vec3 = { x: 0, y: p.y * splayScale, z: clampCurl(p.z) };

  // 3. Mittel- und Endglied können anatomisch nur beugen: x/y hart auf 0.
  //    Widerspricht die Beugerichtung dem Grundglied, ist es Rauschen → stark dämpfen.
  const proximalSign = Math.sign(p.z) || 1;
  const intermediateOut: Vec3 = { x: 0, y: 0, z: clampCurl(alignedCurl(i.z, proximalSign)) };
  const distalOut: Vec3 = { x: 0, y: 0, z: clampCurl(alignedCurl(d.z, proximalSign)) };

  return { proximal: proximalOut, intermediate: intermediateOut, distal: distalOut };
}

function refineThumb(proximal: Vec3, intermediate: Vec3, distal: Vec3): HandFingerRig {
  // Der Daumen braucht alle drei Achsen (Opposition!) — nur Beträge begrenzen.
  return {
    proximal: clampVec(proximal, THUMB_AXIS_MAX),
    intermediate: clampVec(intermediate, THUMB_AXIS_MAX),
    distal: clampVec(distal, THUMB_AXIS_MAX),
  };
}

function reduceOutlier(euler: Vec3): Vec3 {
  if (Math.abs(euler.x) > OUTLIER_X || Math.abs(euler.y) > OUTLIER_Y) {
    // Gekippte Schätzung: alles außer der Beugung verwerfen
    return { x: 0, y: 0, z: euler.z };
  }
  return euler;
}

function alignedCurl(value: number, proximalSign: number): number {
  return Math.sign(value) === proximalSign ? value : value * CHAIN_INCONSISTENCY_DAMP;
}

function clampCurl(value: number): number {
  return Math.max(-CURL_MAX, Math.min(CURL_MAX, value));
}

function clampVec(euler: Vec3, max: number): Vec3 {
  return {
    x: Math.max(-max, Math.min(max, euler.x)),
    y: Math.max(-max, Math.min(max, euler.y)),
    z: Math.max(-max, Math.min(max, euler.z)),
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
