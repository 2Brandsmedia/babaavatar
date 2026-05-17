import type { TrackingSource } from '@shared/types';

export interface CalibrationStep {
  id: StepId;
  title: string;
  subtitle: string;
  icon: string;
  category: 'intro' | 'device' | 'avatar' | 'face' | 'hands' | 'outro';
}

export const STEPS: ReadonlyArray<CalibrationStep> = [
  {
    id: 'welcome',
    title: 'Willkommen',
    subtitle: 'Wir richten dein Tracking in wenigen Schritten ein.',
    icon: '👋',
    category: 'intro',
  },
  {
    id: 'camera',
    title: 'Kamera wählen',
    subtitle: 'Welche Webcam soll dein Gesicht aufnehmen?',
    icon: '📷',
    category: 'device',
  },
  {
    id: 'microphone',
    title: 'Mikrofon wählen',
    subtitle: 'Wir nutzen es für Lipsync, wenn du sprichst.',
    icon: '🎙',
    category: 'device',
  },
  {
    id: 'avatar',
    title: 'Avatar auswählen',
    subtitle: 'Lade einen VRM-Avatar aus deiner Bibliothek.',
    icon: '🎭',
    category: 'avatar',
  },
  {
    id: 'neutral',
    title: 'Neutrale Pose',
    subtitle: 'Schau entspannt in die Kamera, Mund geschlossen.',
    icon: '😐',
    category: 'face',
  },
  {
    id: 'mouth',
    title: 'Mund-Bewegung',
    subtitle: 'Öffne den Mund weit, halt kurz, schließ wieder.',
    icon: '👄',
    category: 'face',
  },
  {
    id: 'eyes',
    title: 'Augen-Blinzeln',
    subtitle: 'Schließe deine Augen fest und öffne sie wieder.',
    icon: '👁',
    category: 'face',
  },
  {
    id: 'brows',
    title: 'Augenbrauen',
    subtitle: 'Hebe deine Brauen so hoch wie möglich.',
    icon: '🤨',
    category: 'face',
  },
  {
    id: 'smile',
    title: 'Lächeln',
    subtitle: 'Zeige dein breitestes Lächeln.',
    icon: '😄',
    category: 'face',
  },
  {
    id: 'hands',
    title: 'Hände sichtbar',
    subtitle: 'Halte beide Hände kurz vor die Kamera.',
    icon: '🖐',
    category: 'hands',
  },
  {
    id: 'done',
    title: 'Fertig',
    subtitle: 'Alles eingerichtet. Du kannst jetzt streamen.',
    icon: '🎉',
    category: 'outro',
  },
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
