import { memo, useEffect, useState } from 'react';
import type { AvatarProfile } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { WebcamPreview } from '@renderer/components/webcam-preview/WebcamPreview';
import { STEPS } from './steps';
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

  useEffect(() => {
    if (!activeAvatarId) {
      setProfile(null);
      return;
    }
    void api.profiles.get(activeAvatarId).then(setProfile);
  }, [activeAvatarId]);

  if (!activeAvatarId) {
    return (
      <div>
        <h2 style={{ margin: 0 }}>Kalibrierung</h2>
        <p style={{ color: '#a0a0a8' }}>Bitte zuerst einen Avatar in der Bibliothek auswählen.</p>
      </div>
    );
  }

  const current = STEPS[stepIndex];
  if (!current) return <></>;
  const total = STEPS.length;

  const handleSave = async (patch: Partial<AvatarProfile['calibration']>): Promise<void> => {
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
  };

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
        {STEPS.map((step, idx) => (
          <li
            key={step.id}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              background: idx === stepIndex ? '#4f46e5' : idx < stepIndex ? '#1c3b22' : '#1c1c22',
              color: idx === stepIndex ? '#fff' : idx < stepIndex ? '#7af2c5' : '#6a6a72',
              border: '1px solid #2a2a32',
            }}
          >
            {step.title}
          </li>
        ))}
      </ol>

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

        <div
          style={{
            background: '#15151a',
            border: '1px solid #2a2a32',
            padding: 20,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CalibrationStepView
            stepId={current.id}
            profile={profile}
            onApply={(patch) => void handleSave(patch)}
            saving={saving}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          aria-label="Vorheriger Schritt"
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
        >
          Zurück
        </button>
        <button
          type="button"
          className="primary"
          aria-label="Nächster Schritt"
          onClick={() => setStepIndex(Math.min(total - 1, stepIndex + 1))}
          disabled={stepIndex === total - 1}
        >
          Weiter
        </button>
      </div>
    </div>
  );
});
