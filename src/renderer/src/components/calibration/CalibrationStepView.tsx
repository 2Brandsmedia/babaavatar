import { memo } from 'react';
import type { AvatarProfile } from '@shared/types';
import { CalibrationCapture } from './CalibrationCapture';
import { CameraStep } from './CameraStep';
import { MicrophoneStep } from './MicrophoneStep';
import { HandsStep } from './HandsStep';
import type { StepId } from './steps';

interface CalibrationStepViewProps {
  stepId: StepId;
  profile: AvatarProfile | null;
  onApply: (patch: Partial<AvatarProfile['calibration']>) => void;
  saving: boolean;
}

export const CalibrationStepView = memo(function CalibrationStepView({
  stepId,
  profile,
  onApply,
  saving,
}: CalibrationStepViewProps): JSX.Element {
  const calibration = profile?.calibration;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
      }}
    >
      {stepId === 'welcome' && (
        <p>
          Diese Kalibrierung erfasst deine persönlichen Baselines (neutrale Pose, Mund-, Augen-,
          Brauen-Bereiche), damit dein Avatar dich präzise abbildet. Es dauert etwa 90 Sekunden.
        </p>
      )}
      {stepId === 'camera' && <CameraStep />}
      {stepId === 'microphone' && <MicrophoneStep />}
      {stepId === 'avatar' && (
        <p>Stelle sicher, dass dein Wunsch-Avatar in der Bibliothek aktiv ist.</p>
      )}
      {stepId === 'neutral' && (
        <CalibrationCapture
          label="Sitz entspannt da, schau gerade in die Kamera. Aufnahme erfasst deine neutrale Augen-Öffnung als Referenzwert."
          field="eyeOpenMax"
          calibration={calibration}
          saving={saving}
          onApply={(value) => onApply({ eyeOpenMax: value as number })}
          source="eye-open"
          mode="average"
        />
      )}
      {stepId === 'mouth' && (
        <CalibrationCapture
          label="Öffne den Mund WEIT auf und halte. Aufnahme erfasst dein Maximum."
          field="mouthOpenMax"
          calibration={calibration}
          saving={saving}
          onApply={(value) => onApply({ mouthOpenMax: value as number })}
          source="mouth-open"
          mode="max"
        />
      )}
      {stepId === 'eyes' && (
        <CalibrationCapture
          label="Halte die Augen WEIT GEÖFFNET. Aufnahme erfasst dein Maximum."
          field="eyeOpenMax"
          calibration={calibration}
          saving={saving}
          onApply={(value) => onApply({ eyeOpenMax: value as number, eyeClosedMin: 0 })}
          source="eye-open"
          mode="max"
        />
      )}
      {stepId === 'brows' && (
        <CalibrationCapture
          label="Ziehe die Augenbrauen so HOCH wie möglich. Halte für die Aufnahme."
          field="browUpMax"
          calibration={calibration}
          saving={saving}
          onApply={(value) => onApply({ browUpMax: value as number })}
          source="brow-up"
          mode="max"
        />
      )}
      {stepId === 'smile' && (
        <CalibrationCapture
          label="Lächle DEUTLICH und halte den Ausdruck. Aufnahme erfasst dein Maximum."
          field="smileMax"
          calibration={calibration}
          saving={saving}
          onApply={(value) => onApply({ smileMax: value as number })}
          source="smile"
          mode="max"
        />
      )}
      {stepId === 'hands' && <HandsStep />}
      {stepId === 'done' && (
        <p>
          Kalibrierung abgeschlossen. Du kannst sie jederzeit erneut durchlaufen. Profile sind pro
          Avatar gespeichert.
        </p>
      )}
    </div>
  );
});
