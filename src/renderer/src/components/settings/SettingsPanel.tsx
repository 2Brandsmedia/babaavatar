import { memo, useState } from 'react';
import { useSettingsStore } from '@renderer/store/settings';
import { TrackingSettings } from './TrackingSettings';
import { BackgroundSettings } from './BackgroundSettings';
import { OutputWindowSettings } from './OutputWindowSettings';
import { PerformanceSettings } from './PerformanceSettings';
import { CompositionSettings } from './CompositionSettings';

type Tab = 'tracking' | 'composition' | 'background' | 'output' | 'performance';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'tracking', label: 'Tracking' },
  { id: 'composition', label: 'Komposition' },
  { id: 'background', label: 'Hintergrund' },
  { id: 'output', label: 'Output-Fenster' },
  { id: 'performance', label: 'Performance' },
];

export const SettingsPanel = memo(function SettingsPanel(): JSX.Element {
  const { settings, update } = useSettingsStore();
  const [tab, setTab] = useState<Tab>('tracking');

  if (!settings) return <p>Lade Einstellungen…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <h2 style={{ margin: 0 }}>Einstellungen</h2>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #2a2a32' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? '#4f46e5' : 'transparent'}`,
              background: 'transparent',
              padding: '8px 14px',
              borderRadius: 0,
              color: tab === t.id ? '#7aa7ff' : '#a0a0a8',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'tracking' && <TrackingSettings settings={settings} onUpdate={update} />}
        {tab === 'composition' && <CompositionSettings settings={settings} onUpdate={update} />}
        {tab === 'background' && <BackgroundSettings settings={settings} onUpdate={update} />}
        {tab === 'output' && <OutputWindowSettings settings={settings} onUpdate={update} />}
        {tab === 'performance' && <PerformanceSettings settings={settings} onUpdate={update} />}
      </div>
    </div>
  );
});
