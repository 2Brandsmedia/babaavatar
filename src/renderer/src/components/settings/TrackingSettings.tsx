import { memo } from 'react';
import type { AppSettings } from '@shared/types';

interface TrackingSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const TrackingSettings = memo(function TrackingSettings({
  settings,
  onUpdate,
}: TrackingSettingsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SliderRow
        label="Smoothing-Stärke"
        value={settings.smoothingFactor}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => void onUpdate('smoothingFactor', v)}
      />
      <SliderRow
        label="Blink-Schwelle"
        value={settings.blinkThreshold}
        min={0.1}
        max={0.9}
        step={0.05}
        onChange={(v) => void onUpdate('blinkThreshold', v)}
      />
      <SliderRow
        label="Mund-Empfindlichkeit"
        value={settings.mouthSensitivity}
        min={0.5}
        max={3}
        step={0.1}
        onChange={(v) => void onUpdate('mouthSensitivity', v)}
      />
      <ToggleRow
        label="Auto-Blink wenn Augen verloren"
        value={settings.autoBlinkEnabled}
        onChange={(v) => void onUpdate('autoBlinkEnabled', v)}
      />
      <ToggleRow
        label="Idle-Animation (Atmung, Body-Sway)"
        value={settings.idleAnimationEnabled}
        onChange={(v) => void onUpdate('idleAnimationEnabled', v)}
      />
      <ToggleRow
        label="Spiegel-Modus"
        value={settings.mirrorMode}
        onChange={(v) => void onUpdate('mirrorMode', v)}
      />
      <div style={{ height: 1, background: '#2a2a32', margin: '6px 0' }} />
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8' }}>
        Lippen-Tracking-Quellen (beide aktiv = höhere Mimik-Genauigkeit)
      </p>
      <ToggleRow
        label="Lippen via Webcam (Mund-Form)"
        value={settings.lipsyncFromCamera}
        onChange={(v) => void onUpdate('lipsyncFromCamera', v)}
      />
      <ToggleRow
        label="Lippen via Mikrofon (Phoneme aus Audio)"
        value={settings.lipsyncFromMic}
        onChange={(v) => void onUpdate('lipsyncFromMic', v)}
      />
    </div>
  );
});

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderRow = memo(function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: SliderRowProps): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#7aa7ff', fontFamily: 'ui-monospace, monospace' }}>{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
});

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow = memo(function ToggleRow({ label, value, onChange }: ToggleRowProps): JSX.Element {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
});
