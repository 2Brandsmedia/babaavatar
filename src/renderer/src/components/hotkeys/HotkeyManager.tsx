import { memo, useEffect, useState } from 'react';
import type { ExpressionHotkey } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';

const DEFAULT_HOTKEYS: ExpressionHotkey[] = [
  { id: 'expression-1', accelerator: 'CommandOrControl+1', expressionName: 'happy', label: 'Lächeln' },
  { id: 'expression-2', accelerator: 'CommandOrControl+2', expressionName: 'angry', label: 'Wut' },
  { id: 'expression-3', accelerator: 'CommandOrControl+3', expressionName: 'sad', label: 'Trauer' },
  { id: 'expression-4', accelerator: 'CommandOrControl+4', expressionName: 'surprised', label: 'Überrascht' },
  { id: 'expression-5', accelerator: 'CommandOrControl+5', expressionName: 'relaxed', label: 'Entspannt' },
];

export const HotkeyManager = memo(function HotkeyManager(): JSX.Element {
  const [hotkeys, setHotkeys] = useState<ExpressionHotkey[]>(DEFAULT_HOTKEYS);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void Promise.all(
      hotkeys.map(async (h) => {
        const ok = await api.hotkeys.register(h);
        if (!ok) {
          setErrors((prev) => {
            const next = new Map(prev);
            next.set(h.id, `${h.accelerator} bereits belegt`);
            return next;
          });
        }
      }),
    );
    return () => {
      hotkeys.forEach((h) => void api.hotkeys.unregister(h.id));
    };
  }, [hotkeys]);

  useEffect(() => {
    return api.on<ExpressionHotkey>(api.ipcChannels.HOTKEY_TRIGGERED, (h) => {
      setLastTriggered(h.label);
      window.setTimeout(() => setLastTriggered(null), 1500);
    });
  }, []);

  const handleChange = (id: string, accelerator: string): void => {
    setHotkeys((prev) => prev.map((h) => (h.id === id ? { ...h, accelerator } : h)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <h2 style={{ margin: 0 }}>Hotkeys & Expressions</h2>
      <p style={{ color: '#a0a0a8', margin: 0 }}>
        Globale Tastenkürzel triggern Ausdrücke auch wenn die App im Hintergrund läuft.
      </p>

      {lastTriggered && (
        <div
          style={{
            background: '#1c3b22',
            color: '#7af2c5',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          Ausgelöst: {lastTriggered}
        </div>
      )}

      <div
        style={{
          background: '#15151a',
          border: '1px solid #2a2a32',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {hotkeys.map((h) => (
          <HotkeyRow
            key={h.id}
            hotkey={h}
            error={errors.get(h.id) ?? null}
            onChange={(value) => handleChange(h.id, value)}
          />
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#52525a', margin: 0 }}>
        Format: <code>CommandOrControl+1</code>, <code>Alt+F</code>, etc. Siehe Electron-Accelerator-Syntax.
      </p>
    </div>
  );
});

interface HotkeyRowProps {
  hotkey: ExpressionHotkey;
  error: string | null;
  onChange: (accelerator: string) => void;
}

const HotkeyRow = memo(function HotkeyRow({ hotkey, error, onChange }: HotkeyRowProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.5fr',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 13 }}>{hotkey.label}</div>
      <div style={{ fontSize: 12, color: '#7aa7ff', fontFamily: 'ui-monospace, monospace' }}>
        {hotkey.expressionName}
      </div>
      <div>
        <input
          type="text"
          value={hotkey.accelerator}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: 6,
            borderRadius: 6,
            border: '1px solid #2a2a32',
            background: '#0f0f12',
            color: '#e8e8ec',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
          }}
        />
        {error && <small style={{ color: '#ff7878' }}>{error}</small>}
      </div>
    </div>
  );
});
