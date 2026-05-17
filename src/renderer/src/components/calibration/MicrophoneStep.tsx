import { memo, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@renderer/store/settings';

interface DeviceOption {
  deviceId: string;
  label: string;
}

const SMOOTHING_UP = 0.45;
const SMOOTHING_DOWN = 0.12;
const GAIN = 12;
const PEAK_DECAY = 0.985;

interface MicrophoneStepProps {
  onComplete?: () => void;
}

export const MicrophoneStep = memo(function MicrophoneStep({ onComplete }: MicrophoneStepProps): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.update);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let active = true;
    const currentId = settings?.selectedMicrophoneId ?? null;

    const start = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: currentId ? { exact: currentId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);

        let smoothLevel = 0;
        let smoothPeak = 0;

        const tick = (): void => {
          if (!active) return;
          analyser.getFloatTimeDomainData(buffer);
          let sumSq = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const v = buffer[i] ?? 0;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buffer.length);
          const raw = Math.min(1, rms * GAIN);
          const direction = raw > smoothLevel ? SMOOTHING_UP : SMOOTHING_DOWN;
          smoothLevel += (raw - smoothLevel) * direction;
          smoothPeak = Math.max(smoothPeak * PEAK_DECAY, smoothLevel);

          setLevel(smoothLevel);
          setPeak(smoothPeak);
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
      audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
  }, [settings?.selectedMicrophoneId]);

  const currentId = settings?.selectedMicrophoneId ?? '';
  const levelPct = Math.round(level * 100);
  const peakPct = Math.round(peak * 100);
  const goodLevel = levelPct >= 15 && levelPct <= 85;

  useEffect(() => {
    if (peak >= 0.15) onComplete?.();
  }, [peak, onComplete]);

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
          <span style={{ color: goodLevel ? '#7af2c5' : '#a0a0a8', fontFamily: 'ui-monospace, monospace' }}>
            {levelPct}% (Peak {peakPct}%)
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 16,
            background: '#26262e',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${levelPct}%`,
              background:
                levelPct > 85
                  ? '#ff6b6b'
                  : levelPct > 60
                    ? '#ff9670'
                    : levelPct > 12
                      ? '#7af2c5'
                      : '#4a4a52',
              height: '100%',
              transition: 'width 40ms linear',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${peakPct}%`,
              width: 2,
              height: '100%',
              background: '#ffffff',
              opacity: 0.6,
            }}
          />
        </div>
        <small style={{ color: goodLevel ? '#7af2c5' : '#a0a0a8' }}>
          {levelPct < 5
            ? 'Stille erkannt — sprich kurz rein.'
            : levelPct < 15
              ? 'Sehr leise — eventuell anderes Mikrofon wählen oder Lautstärke erhöhen.'
              : levelPct > 85
                ? 'Übersteuert! Mikrofon weiter weg halten.'
                : 'Pegel passt — beim Sprechen sollten 30–60% erreicht werden.'}
        </small>
      </div>
    </div>
  );
});
