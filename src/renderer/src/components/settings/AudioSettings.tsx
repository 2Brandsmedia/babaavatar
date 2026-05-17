import { memo, useEffect, useRef } from 'react';
import type { AppSettings } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';

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

interface VuMeterProps {
  threshold: number;
}

const VuMeter = memo(function VuMeter({ threshold }: VuMeterProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const ledRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const { micLevel, micGateOpen } = useTrackingStore.getState();
      const pct = Math.min(100, Math.max(0, micLevel * 100));
      if (barRef.current) {
        barRef.current.style.width = `${pct}%`;
        barRef.current.style.background = micGateOpen
          ? 'linear-gradient(90deg, #4ade80 0%, #facc15 70%, #ef4444 100%)'
          : 'linear-gradient(90deg, #3a3a44 0%, #4a4a55 100%)';
      }
      if (ledRef.current) {
        ledRef.current.style.background = micGateOpen ? '#4ade80' : '#3a3a44';
        ledRef.current.style.boxShadow = micGateOpen
          ? '0 0 8px rgba(74,222,128,0.7)'
          : 'none';
      }
      if (valueRef.current) {
        valueRef.current.textContent = micLevel.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const markerLeft = `${Math.min(100, Math.max(0, threshold * 100))}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          ref={ledRef}
          aria-label="Voice-Activity-LED"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#3a3a44',
            transition: 'background 80ms linear, box-shadow 80ms linear',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            position: 'relative',
            flex: 1,
            height: 14,
            background: '#1a1a22',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid #2a2a32',
          }}
        >
          <div
            ref={barRef}
            style={{
              width: '0%',
              height: '100%',
              background: '#3a3a44',
              transition: 'width 60ms linear',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -2,
              bottom: -2,
              left: markerLeft,
              width: 2,
              background: '#7aa7ff',
              boxShadow: '0 0 4px rgba(122,167,255,0.7)',
            }}
          />
        </div>
        <span
          ref={valueRef}
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: '#7aa7ff',
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          0.000
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6a6a72' }}>
        <span>Stille</span>
        <span>Schwelle (blau)</span>
        <span>Laut</span>
      </div>
    </div>
  );
});

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

const SliderRow = memo(function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderRowProps): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#7aa7ff', fontFamily: 'ui-monospace, monospace' }}>
          {format(value)}
        </span>
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
