import { memo, useEffect } from 'react';
import type { AvatarProfile } from '@shared/types';
import { CalibrationCapture } from './CalibrationCapture';
import { CameraStep } from './CameraStep';
import { MicrophoneStep } from './MicrophoneStep';
import { HandsStep } from './HandsStep';
import { AvatarPickerStep } from './AvatarPickerStep';
import type { StepId } from './steps';

interface CalibrationStepViewProps {
  stepId: StepId;
  profile: AvatarProfile | null;
  onApply: (patch: Partial<AvatarProfile['calibration']>) => void;
  saving: boolean;
  onComplete: () => void;
}

export const CalibrationStepView = memo(function CalibrationStepView({
  stepId,
  profile,
  onApply,
  saving,
  onComplete,
}: CalibrationStepViewProps): JSX.Element {
  const calibration = profile?.calibration;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      {stepId === 'welcome' && (
        <p style={{ margin: 0 }}>
          Diese Kalibrierung erfasst deine persönlichen Baselines (neutrale Pose, Mund-, Augen-,
          Brauen-Bereiche), damit dein Avatar dich präzise abbildet. Es dauert etwa 90 Sekunden.
        </p>
      )}
      {stepId === 'camera' && <CameraStep onComplete={onComplete} />}
      {stepId === 'microphone' && <MicrophoneStep onComplete={onComplete} />}
      {stepId === 'avatar' && <AvatarPickerStep onPicked={onComplete} />}
      {stepId === 'neutral' && (
        <CalibrationCapture
          label="Sitz entspannt da, schau gerade in die Kamera. Aufnahme erfasst deine neutrale Augen-Öffnung als Referenzwert."
          calibration={calibration}
          saving={saving}
          onApply={(value) => {
            onApply({ eyeOpenMax: value as number });
            onComplete();
          }}
          source="eye-open"
          mode="average"
        />
      )}
      {stepId === 'mouth' && (
        <CalibrationCapture
          label="Öffne den Mund WEIT auf und halte. Aufnahme erfasst dein Maximum."
          calibration={calibration}
          saving={saving}
          onApply={(value) => {
            onApply({ mouthOpenMax: value as number });
            onComplete();
          }}
          source="mouth-open"
          mode="max"
        />
      )}
      {stepId === 'eyes' && (
        <CalibrationCapture
          label="Halte die Augen WEIT GEÖFFNET. Aufnahme erfasst dein Maximum."
          calibration={calibration}
          saving={saving}
          onApply={(value) => {
            onApply({ eyeOpenMax: value as number, eyeClosedMin: 0 });
            onComplete();
          }}
          source="eye-open"
          mode="max"
        />
      )}
      {stepId === 'brows' && (
        <CalibrationCapture
          label="Ziehe die Augenbrauen so HOCH wie möglich. Halte für die Aufnahme."
          calibration={calibration}
          saving={saving}
          onApply={(value) => {
            onApply({ browUpMax: value as number });
            onComplete();
          }}
          source="brow-up"
          mode="max"
        />
      )}
      {stepId === 'smile' && (
        <CalibrationCapture
          label="Lächle DEUTLICH und halte den Ausdruck. Aufnahme erfasst dein Maximum."
          calibration={calibration}
          saving={saving}
          onApply={(value) => {
            onApply({ smileMax: value as number });
            onComplete();
          }}
          source="smile"
          mode="max"
        />
      )}
      {stepId === 'hands' && <HandsStep onConfirmed={onComplete} />}
      {stepId === 'done' && <DoneStep onComplete={onComplete} />}
    </div>
  );
});

interface DoneStepProps {
  onComplete: () => void;
}

const DoneStep = memo(function DoneStep({ onComplete }: DoneStepProps): JSX.Element {
  useEffect(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          background: '#0d2a1e',
          border: '1px solid #1a4d36',
          padding: 14,
          borderRadius: 8,
          color: '#7af2c5',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ✓ Kalibrierung abgeschlossen
      </div>
      <p style={{ margin: 0, color: '#a0a0a8', fontSize: 13, lineHeight: 1.5 }}>
        Profile ist gespeichert. Du kannst jederzeit zu einzelnen Schritten zurückkehren und sie
        erneut durchlaufen. Wenn ein Schritt im Header noch grau ist, kannst du ihn anklicken um
        ihn nachzuholen.
      </p>
    </div>
  );
});
