import { memo } from 'react';
import type { AppSettings, GestureAction, GestureName } from '@shared/types';
import { GESTURE_NAMES } from '@shared/types';
import { SliderRow, ToggleRow } from '@renderer/components/ui/FormRows';
import { GestureRow } from './GestureRow';

interface GestureSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const GestureSettings = memo(function GestureSettings({
  settings,
  onUpdate,
}: GestureSettingsProps): JSX.Element {
  const updateMapping = (name: GestureName, action: GestureAction | null): void => {
    const next = { ...settings.gestureMappings, [name]: action };
    void onUpdate('gestureMappings', next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8' }}>
        Hand-Gesten werden aus den Webcam-Landmarks erkannt. Halte eine Geste so lange wie
        die Hold-Dauer vorgibt, dann wird die zugeordnete Aktion ausgelöst.
      </p>

      <ToggleRow
        label="Gesten-Erkennung aktiv"
        value={settings.gestureDetectionEnabled}
        onChange={(v) => void onUpdate('gestureDetectionEnabled', v)}
      />

      <SliderRow
        label="Hold-Dauer (Millisekunden)"
        value={settings.gestureHoldMs}
        min={200}
        max={2000}
        step={50}
        format={(v) => `${v} ms`}
        onChange={(v) => void onUpdate('gestureHoldMs', v)}
      />
      <SliderRow
        label="Cooldown nach Trigger"
        value={settings.gestureCooldownMs}
        min={500}
        max={5000}
        step={100}
        format={(v) => `${v} ms`}
        onChange={(v) => void onUpdate('gestureCooldownMs', v)}
      />
      <SliderRow
        label="Mindest-Confidence"
        value={settings.gestureMinConfidence}
        min={0.5}
        max={1}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => void onUpdate('gestureMinConfidence', v)}
      />

      <div style={{ height: 1, background: '#2a2a32', margin: '6px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {GESTURE_NAMES.map((name: GestureName) => (
          <GestureRow
            key={name}
            name={name}
            action={settings.gestureMappings[name] ?? null}
            onChange={(action) => updateMapping(name, action)}
          />
        ))}
      </div>
    </div>
  );
});
