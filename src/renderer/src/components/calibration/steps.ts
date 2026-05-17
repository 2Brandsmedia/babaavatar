import type { TrackingSource } from '@shared/types';

export interface CalibrationStep {
  id: StepId;
  title: string;
  category: 'intro' | 'device' | 'avatar' | 'face' | 'hands' | 'outro';
}

export const STEPS: ReadonlyArray<CalibrationStep> = [
  { id: 'welcome', title: 'Willkommen', category: 'intro' },
  { id: 'camera', title: 'Kamera', category: 'device' },
  { id: 'microphone', title: 'Mikrofon', category: 'device' },
  { id: 'avatar', title: 'Avatar', category: 'avatar' },
  { id: 'neutral', title: 'Neutrale Pose', category: 'face' },
  { id: 'mouth', title: 'Mund', category: 'face' },
  { id: 'eyes', title: 'Augen', category: 'face' },
  { id: 'brows', title: 'Augenbrauen', category: 'face' },
  { id: 'smile', title: 'Lächeln', category: 'face' },
  { id: 'hands', title: 'Hände', category: 'hands' },
  { id: 'done', title: 'Fertig', category: 'outro' },
] as const;

export type StepId =
  | 'welcome'
  | 'camera'
  | 'microphone'
  | 'avatar'
  | 'neutral'
  | 'mouth'
  | 'eyes'
  | 'brows'
  | 'smile'
  | 'hands'
  | 'done';

export interface StepSkipState {
  skippedIds: Set<StepId>;
  reason: Map<StepId, string>;
}

/**
 * Bestimmt welche Steps fuer die aktive Tracking-Quelle ueberfluessig sind.
 * - external (iPhone allein): Webcam-spezifische Schritte und Hand-Tracking weg
 * - external + Face/Head: Face-Kalibrierungs-Schritte weg (iPhone liefert die)
 * - both: Hands bleibt (Webcam), Face skippbar wenn iPhone Face liefert
 * - webcam: nichts skippen
 */
export function computeSkippedSteps(
  source: TrackingSource,
  vmcSourceFace: boolean,
): StepSkipState {
  const skipped = new Set<StepId>();
  const reason = new Map<StepId, string>();
  const faceSteps: StepId[] = ['neutral', 'mouth', 'eyes', 'brows', 'smile'];

  if (source === 'external') {
    if (vmcSourceFace) {
      for (const id of faceSteps) {
        skipped.add(id);
        reason.set(id, 'iPhone-Tracker liefert die Gesichtsdaten — keine Kalibrierung nötig.');
      }
    }
    skipped.add('camera');
    reason.set('camera', 'Webcam ist deaktiviert (Tracking-Quelle: iPhone).');
    skipped.add('hands');
    reason.set('hands', 'Hand-Tracking ist mit dem iPhone allein nicht verfügbar.');
  } else if (source === 'both' && vmcSourceFace) {
    for (const id of faceSteps) {
      skipped.add(id);
      reason.set(id, 'iPhone-Tracker liefert die Gesichtsdaten — keine Kalibrierung nötig.');
    }
  }

  return { skippedIds: skipped, reason };
}
