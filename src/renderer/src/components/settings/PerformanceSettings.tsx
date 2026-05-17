import { memo } from 'react';
import type { AppSettings } from '@shared/types';

interface PerformanceSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const PerformanceSettings = memo(function PerformanceSettings({
  settings,
  onUpdate,
}: PerformanceSettingsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
          <span>Kamera-Ziel-FPS</span>
          <span style={{ color: '#7aa7ff' }}>{settings.cameraFps}</span>
        </span>
        <input
          type="range"
          min={15}
          max={120}
          step={5}
          value={settings.cameraFps}
          onChange={(e) => void onUpdate('cameraFps', Number(e.target.value))}
        />
      </label>
      <p style={{ fontSize: 12, color: '#52525a', margin: 0 }}>
        Empfehlung: 60 auf RTX 4090, 30 auf schwächeren GPUs. Höhere Werte bei guter Hardware → flüssigeres Tracking.
      </p>
    </div>
  );
});
