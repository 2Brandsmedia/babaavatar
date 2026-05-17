import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { AvatarProfile } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { WebcamPreview } from '@renderer/components/webcam-preview/WebcamPreview';
import { STEPS, type StepId } from './steps';
import { CalibrationStepView } from './CalibrationStepView';

interface CalibrationWizardProps {
  activeAvatarId: string | null;
}

export const CalibrationWizard = memo(function CalibrationWizard({
  activeAvatarId,
}: CalibrationWizardProps): JSX.Element {
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());

  useEffect(() => {
    if (!activeAvatarId) {
      setProfile(null);
      return;
    }
    void api.profiles.get(activeAvatarId).then((p) => {
      setProfile(p);
      if (p) {
        const done = new Set<StepId>();
        done.add('welcome');
        if (p.calibration.eyeOpenMax !== null) done.add('neutral');
        if (p.calibration.mouthOpenMax !== null) done.add('mouth');
        if (p.calibration.eyeOpenMax !== null) done.add('eyes');
        if (p.calibration.browUpMax !== null) done.add('brows');
        if (p.calibration.smileMax !== null) done.add('smile');
        setCompleted(done);
      }
    });
  }, [activeAvatarId]);

  const current = STEPS[stepIndex];
  const total = STEPS.length;

  const markCompleted = useCallback((id: StepId) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (current?.id) markCompleted('welcome');
  }, [current?.id, markCompleted]);

  const handleSave = useCallback(
    async (patch: Partial<AvatarProfile['calibration']>): Promise<void> => {
      if (!profile) return;
      setSaving(true);
      try {
        const next: AvatarProfile = {
          ...profile,
          calibration: { ...profile.calibration, ...patch },
        };
        const saved = await api.profiles.set(next);
        setProfile(saved);
      } finally {
        setSaving(false);
      }
    },
    [profile],
  );

  const goPrev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setStepIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  );

  const isLast = stepIndex === total - 1;
  const showFinish = current?.id === 'hands' && completed.has('hands');

  const layoutMode = useMemo<'avatar-only' | 'webcam-content' | 'content-only'>(() => {
    if (!current) return 'content-only';
    if (current.id === 'avatar') return 'content-only';
    if (current.id === 'welcome' || current.id === 'done') return 'content-only';
    return 'webcam-content';
  }, [current]);

  if (!current) return <></>;

  if (!activeAvatarId && current.id !== 'avatar' && current.id !== 'welcome') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Kalibrierung</h2>
        <p style={{ color: '#a0a0a8' }}>
          Bitte zuerst einen Avatar im Schritt 4 (Avatar) auswählen oder in der Bibliothek aktiv schalten.
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => setStepIndex(STEPS.findIndex((s) => s.id === 'avatar'))}
        >
          Zum Avatar-Schritt
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h2 style={{ margin: 0 }}>Kalibrierung</h2>
        <p style={{ color: '#a0a0a8', margin: '4px 0 0 0' }}>
          Schritt {stepIndex + 1} von {total}: {current.title}
        </p>
      </header>

      <ol
        style={{
          display: 'flex',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {STEPS.map((step, idx) => {
          const isActive = idx === stepIndex;
          const isDone = completed.has(step.id);
          return (
            <li
              key={step.id}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                background: isActive ? '#4f46e5' : isDone ? '#1c3b22' : '#1c1c22',
                color: isActive ? '#fff' : isDone ? '#7af2c5' : '#6a6a72',
                border: `1px solid ${isDone && !isActive ? '#1a4d36' : '#2a2a32'}`,
                cursor: 'pointer',
              }}
              onClick={() => setStepIndex(idx)}
            >
              {isDone && !isActive ? '✓ ' : ''}
              {step.title}
            </li>
          );
        })}
      </ol>

      {layoutMode === 'webcam-content' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(360px, 1.2fr) minmax(360px, 1fr)',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#a0a0a8' }}>Live-Webcam</div>
            <WebcamPreview aspectRatio="4 / 3" />
          </div>
          <ActionBox
            stepId={current.id}
            profile={profile}
            saving={saving}
            onApply={(patch) => void handleSave(patch)}
            onStepComplete={() => markCompleted(current.id)}
            onPrev={goPrev}
            onNext={goNext}
            canPrev={stepIndex > 0}
            canNext={!isLast}
            isLast={isLast}
            showFinish={showFinish}
          />
        </div>
      ) : (
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
            stepId={current.id}
            profile={profile}
            onApply={(patch) => void handleSave(patch)}
            saving={saving}
            onComplete={() => markCompleted(current.id)}
          />
          <NavBar
            onPrev={goPrev}
            onNext={goNext}
            canPrev={stepIndex > 0}
            canNext={!isLast}
            isLast={isLast}
            showFinish={false}
          />
        </div>
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

const ActionBox = memo(function ActionBox({
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

interface NavBarProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  showFinish: boolean;
}

const NavBar = memo(function NavBar({
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
      <button
        type="button"
        aria-label="Vorheriger Schritt"
        onClick={onPrev}
        disabled={!canPrev}
      >
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
