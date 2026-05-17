import { memo, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@renderer/store/settings';

interface DeviceOption {
  deviceId: string;
  label: string;
}

export const MicrophoneStep = memo(function MicrophoneStep(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.update);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let active = true;
    const currentId = settings?.selectedMicrophoneId ?? null;

    const start = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: currentId ? { deviceId: { exact: currentId } } : true,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);

        const tick = (): void => {
          if (!active) return;
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const v = (buffer[i] ?? 128) - 128;
            sum += v * v;
          }
          setLevel(Math.min(1, Math.sqrt(sum / buffer.length) / 64));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();

        const list = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        setDevices(
          list
            .filter((d) => d.kind === 'audioinput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`,
            })),
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Mikrofon-Zugriff verweigert');
      }
    };

    void start();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [settings?.selectedMicrophoneId]);

  const currentId = settings?.selectedMicrophoneId ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0 }}>
        Wähle das Mikrofon. Die Lautstärken-Anzeige zeigt live, was die App hört. Sprich kurz rein,
        um zu testen.
      </p>
      {error && (
        <div
          style={{
            background: '#3a1818',
            border: '1px solid #5a2828',
            color: '#ff9670',
            padding: 10,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Aktives Mikrofon</span>
        <select
          value={currentId}
          disabled={devices.length === 0}
          onChange={(e) => void updateSetting('selectedMicrophoneId', e.target.value || null)}
        >
          <option value="">— Standard —</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span>Pegel</span>
          <span style={{ color: '#7af2c5', fontFamily: 'ui-monospace, monospace' }}>
            {Math.round(level * 100)}%
          </span>
        </div>
        <div
          style={{
            height: 14,
            background: '#26262e',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${level * 100}%`,
              background: level > 0.7 ? '#ff9670' : '#7af2c5',
              height: '100%',
              transition: 'width 80ms linear',
            }}
          />
        </div>
        <small style={{ color: '#a0a0a8' }}>
          Tipp: Beim normalen Sprechen sollten 30–60% erreicht werden.
        </small>
      </div>
    </div>
  );
});
