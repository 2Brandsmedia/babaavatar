import { memo } from 'react';
import type { AppSettings } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';

interface OutputWindowSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const OutputWindowSettings = memo(function OutputWindowSettings({
  settings,
  onUpdate,
}: OutputWindowSettingsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="checkbox"
          checked={settings.outputAlwaysOnTop}
          onChange={(e) => {
            const next = e.target.checked;
            void onUpdate('outputAlwaysOnTop', next);
            void api.output.setAlwaysOnTop(next);
          }}
        />
        Output-Fenster immer im Vordergrund
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => void api.output.open()}>
          Output-Fenster zeigen
        </button>
        <button type="button" onClick={() => void api.output.close()}>
          Output-Fenster verstecken
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#52525a', margin: 0 }}>
        In OBS: "Fenster-Aufnahme" → BabaAvatar Output → Filter "Chroma-Key" mit der eingestellten
        Hintergrundfarbe.
      </p>
    </div>
  );
});
