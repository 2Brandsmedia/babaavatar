import { memo } from 'react';
import type { AppSettings } from '@shared/types';

interface BackgroundSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const PRESETS = [
  { label: 'Chroma Grün (OBS-Standard)', color: '#00B140' },
  { label: 'Magenta', color: '#FF00FF' },
  { label: 'Blau', color: '#0066FF' },
  { label: 'Schwarz', color: '#000000' },
];

export const BackgroundSettings = memo(function BackgroundSettings({
  settings,
  onUpdate,
}: BackgroundSettingsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#a0a0a8', margin: 0 }}>
        Wähle die Hintergrundfarbe für das Output-Fenster. In OBS dann den passenden Chroma-Key-Filter
        anwenden.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.color}
            type="button"
            aria-label={`Hintergrundfarbe ${p.label}`}
            onClick={() => void onUpdate('chromaColor', p.color)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: `2px solid ${settings.chromaColor === p.color ? '#fff' : '#2a2a32'}`,
              background: p.color,
              color: getContrastColor(p.color),
              minWidth: 160,
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Eigene Farbe</span>
        <input
          type="color"
          value={settings.chromaColor}
          onChange={(e) => void onUpdate('chromaColor', e.target.value)}
        />
      </label>
    </div>
  );
});

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.5 ? '#000' : '#fff';
}
