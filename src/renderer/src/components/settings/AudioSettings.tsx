import { memo } from 'react';
import type { AppSettings } from '@shared/types';
import { SliderRow } from '@renderer/components/ui/FormRows';
import { VuMeter } from './VuMeter';

interface AudioSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const AudioSettings = memo(function AudioSettings({
  settings,
  onUpdate,
}: AudioSettingsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8' }}>
        Mikrofon-Eingang für Lipsync. Das Noise-Gate verhindert, dass der Mund bei
        Tastatur-, Lüfter- oder Hintergrundgeräuschen flattert. Stelle die Schwelle so ein,
        dass die LED nur beim Sprechen leuchtet.
      </p>

      <VuMeter threshold={settings.micNoiseGate} />

      <SliderRow
        label="Mikrofon-Gain"
        value={settings.micGain}
        min={0.5}
        max={3}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => void onUpdate('micGain', v)}
      />
      <SliderRow
        label="Noise-Gate (Stille-Schwelle)"
        value={settings.micNoiseGate}
        min={0}
        max={0.3}
        step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={(v) => void onUpdate('micNoiseGate', v)}
      />

      <div
        style={{
          padding: 10,
          background: '#1a1a22',
          borderRadius: 6,
          fontSize: 12,
          color: '#a0a0a8',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: '#cfd0d6' }}>Faustregel:</strong> Erst Gain so einstellen, dass
        der Pegel beim normalen Sprechen ~60–80 % erreicht. Dann Gate gerade so hoch ziehen,
        dass die LED bei Schweigen aus bleibt. Das Gate nutzt eine Hysterese (öffnet bei der
        Schwelle, schliesst erst bei 70 % davon) gegen Flattern.
      </div>
    </div>
  );
});
