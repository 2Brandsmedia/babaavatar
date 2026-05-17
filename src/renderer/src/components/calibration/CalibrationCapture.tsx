import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarProfile, PoseFrame } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { LiveValueBar } from './LiveValueBar';

const RECORD_SECONDS = 3;

interface CalibrationCaptureProps {
  label: string;
  field: keyof AvatarProfile['calibration'];
  calibration: AvatarProfile['calibration'] | undefined;
  saving: boolean;
  onApply: (value: number | number[]) => void;
  source: 'mouth-open' | 'eye-open' | 'brow-up' | 'smile' | 'neutral';
  mode: 'max' | 'min' | 'average';
}

export const CalibrationCapture = memo(function CalibrationCapture({
  label,
  field,
  calibration,
  saving,
  onApply,
  source,
  mode,
}: CalibrationCaptureProps): JSX.Element {
  const pose = useTrackingStore((state) => state.pose);
  const trackingReady = useTrackingStore((state) => state.trackingReady);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const samplesRef = useRef<number[]>([]);

  const liveValue = readScalar(pose, source);
  const storedRaw = calibration ? calibration[field] : null;
  const stored = typeof storedRaw === 'number' ? storedRaw : null;

  const [overrideValue, setOverrideValue] = useState<number | null>(null);

  const handleRecord = useCallback(() => {
    if (recording) return;
    setRecording(true);
    setOverrideValue(null);
    samplesRef.current = [];
    const start = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const v = readScalar(useTrackingStore.getState().pose, source);
      if (v !== null) samplesRef.current.push(v);
      setRecordProgress(Math.min(elapsed / RECORD_SECONDS, 1));
      if (elapsed >= RECORD_SECONDS) {
        window.clearInterval(interval);
        const result = aggregate(samplesRef.current, mode);
        setRecording(false);
        setRecordProgress(0);
        if (result !== null) {
          setOverrideValue(result);
          onApply(result);
        }
      }
    }, 50);
  }, [mode, onApply, recording, source]);

  useEffect(() => {
    if (typeof stored === 'number') setOverrideValue(stored);
  }, [stored]);

  useEffect(() => () => undefined, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0 }}>{label}</p>
      <LiveValueBar
        label="Live-Wert (mach die Pose jetzt)"
        value={liveValue ?? 0}
        reference={stored}
      />
      {recording && (
        <div
          style={{
            background: '#1c1c22',
            border: '1px solid #4f46e5',
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            color: '#a0bcff',
          }}
        >
          Aufnahme läuft… {Math.round(recordProgress * 100)}%
          <div
            style={{
              marginTop: 6,
              height: 4,
              background: '#26262e',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${recordProgress * 100}%`,
                background: '#7aa7ff',
                height: '100%',
              }}
            />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="primary"
          disabled={saving || !trackingReady || recording}
          onClick={handleRecord}
        >
          {RECORD_SECONDS}-Sek-Aufnahme starten
        </button>
        <button
          type="button"
          disabled={saving || recording || liveValue === null}
          onClick={() => liveValue !== null && onApply(liveValue)}
        >
          Aktuellen Wert übernehmen
        </button>
        <button
          type="button"
          disabled={saving || recording}
          onClick={() => {
            setOverrideValue(0);
            onApply(0);
          }}
        >
          Zurücksetzen
        </button>
      </div>
      {overrideValue !== null && !recording && (
        <div
          style={{
            background: '#1c1c22',
            border: '1px solid #2a2a32',
            padding: 10,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>Wert manuell anpassen</span>
            <span style={{ color: '#7aa7ff', fontFamily: 'ui-monospace, monospace' }}>
              {overrideValue.toFixed(3)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={overrideValue}
            disabled={saving}
            onChange={(e) => {
              const v = Number(e.target.value);
              setOverrideValue(v);
              onApply(v);
            }}
          />
          <small style={{ color: '#a0a0a8' }}>
            Wenn der Auto-Messwert nicht passt, hier nachjustieren.
          </small>
        </div>
      )}
      {!trackingReady && (
        <small style={{ color: '#ff9670' }}>
          Webcam in der Statusleiste oben einschalten.
        </small>
      )}
    </div>
  );
});

function readScalar(pose: PoseFrame | null, source: CalibrationCaptureProps['source']): number | null {
  if (!pose?.face) return null;
  const face = pose.face;
  switch (source) {
    case 'mouth-open':
      return face.mouth.A;
    case 'eye-open':
      return (face.eyeL + face.eyeR) / 2;
    case 'brow-up':
      return face.brow;
    case 'smile':
      return face.mouth.I;
    case 'neutral':
      return (face.eyeL + face.eyeR) / 2;
    default:
      return null;
  }
}

function aggregate(samples: number[], mode: 'max' | 'min' | 'average'): number | null {
  if (samples.length === 0) return null;
  if (mode === 'max') return Math.max(...samples);
  if (mode === 'min') return Math.min(...samples);
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return sum / samples.length;
}
