import { memo } from 'react';
import type { AvatarProfile } from '@shared/types';
import { CalibrationStepView } from './CalibrationStepView';
import type { StepId } from './steps';

interface NavBarProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  showFinish: boolean;
}

export const NavBar = memo(function NavBar({
  onPrev,
  onNext,
  canPrev,
  canNext,
  isLast,
  showFinish,
}: NavBarProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid #2a2a32',
      }}
    >
      <button type="button" aria-label="Vorheriger Schritt" onClick={onPrev} disabled={!canPrev}>
        Zurück
      </button>
      <div style={{ flex: 1 }} />
      {showFinish ? (
        <button type="button" className="primary" onClick={onNext}>
          Kalibrierung abschließen ✓
        </button>
      ) : (
        <button
          type="button"
          className="primary"
          aria-label="Nächster Schritt"
          onClick={onNext}
          disabled={isLast || !canNext}
        >
          Weiter
        </button>
      )}
    </div>
  );
});

interface ActionBoxProps {
  stepId: StepId;
  profile: AvatarProfile | null;
  saving: boolean;
  onApply: (patch: Partial<AvatarProfile['calibration']>) => void;
  onStepComplete: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  showFinish: boolean;
}

export const ActionBox = memo(function ActionBox({
  stepId,
  profile,
  saving,
  onApply,
  onStepComplete,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isLast,
  showFinish,
}: ActionBoxProps): JSX.Element {
  return (
    <div
      style={{
        background: '#15151a',
        border: '1px solid #2a2a32',
        padding: 20,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <CalibrationStepView
        stepId={stepId}
        profile={profile}
        onApply={onApply}
        saving={saving}
        onComplete={onStepComplete}
      />
      <NavBar
        onPrev={onPrev}
        onNext={onNext}
        canPrev={canPrev}
        canNext={canNext}
        isLast={isLast}
        showFinish={showFinish}
      />
    </div>
  );
});
