import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { AvatarProfile } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { useSettingsStore } from '@renderer/store/settings';
import { WebcamPreview } from '@renderer/components/webcam-preview/WebcamPreview';
import { STEPS, computeSkippedSteps, type StepId } from './steps';
import { CalibrationStepView } from './CalibrationStepView';
import { ActionBox, NavBar } from './calibration-ui';
import { SkipBanner, StepBar } from './StepBar';

interface CalibrationWizardProps {
  activeAvatarId: string | null;
}

export const CalibrationWizard = memo(function CalibrationWizard({
  activeAvatarId,
}: CalibrationWizardProps): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());

  const skipped = useMemo(
    () =>
      computeSkippedSteps(
        settings?.trackingSource ?? 'webcam',
        settings?.vmcSourceFace ?? true,
      ),
    [settings?.trackingSource, settings?.vmcSourceFace],
  );

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

  const goPrev = useCallback(() => {
    setStepIndex((i) => {
      let next = i - 1;
      while (next > 0 && current && skipped.skippedIds.has(STEPS[next]?.id as StepId)) {
        next -= 1;
      }
      return Math.max(0, next);
    });
  }, [current, skipped.skippedIds]);

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      let next = i + 1;
      while (next < total - 1 && skipped.skippedIds.has(STEPS[next]?.id as StepId)) {
        next += 1;
      }
      return Math.min(total - 1, next);
    });
  }, [total, skipped.skippedIds]);

  const isLast = stepIndex === total - 1;
  const lastActionableStep = useMemo(() => {
    for (let i = total - 2; i >= 0; i -= 1) {
      const id = STEPS[i]?.id as StepId | undefined;
      if (id && !skipped.skippedIds.has(id)) return id;
    }
    return null;
  }, [total, skipped.skippedIds]);
  const showFinish = current?.id === lastActionableStep && completed.has(current.id);
  const currentSkipReason = current ? skipped.reason.get(current.id) ?? null : null;

  const layoutMode = useMemo<'webcam-content' | 'content-only'>(() => {
    if (!current) return 'content-only';
    if (current.id === 'avatar' || current.id === 'welcome' || current.id === 'done')
      return 'content-only';
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

      <StepBar
        activeIndex={stepIndex}
        completed={completed}
        skipped={skipped}
        onSelect={setStepIndex}
      />

      {currentSkipReason && <SkipBanner reason={currentSkipReason} onSkip={goNext} />}

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
