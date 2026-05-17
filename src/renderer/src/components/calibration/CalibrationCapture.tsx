import { memo, useCallback, useRef, useState } from 'react';
import type { AvatarProfile, PoseFrame } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { LiveValueBar } from './LiveValueBar';

const RECORD_SECONDS = 5;

interface CalibrationCaptureProps {
  label: string;
  calibration: AvatarProfile['calibration'] | undefined;
  saving: boolean;
  onApply: (value: number | number[]) => void;
  source: 'mouth-open' | 'eye-open' | 'brow-up' | 'smile' | 'neutral';
  mode: 'max' | 'min' | 'average';
}

export const CalibrationCapture = memo(function CalibrationCapture({
  label,
  saving,
  onApply,
  source,
  mode,
}: CalibrationCaptureProps): JSX.Element {
  const pose = useTrackingStore((state) => state.pose);
  const trackingReady = useTrackingStore((state) => state.trackingReady);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [captured, setCaptured] = useState<number | null>(null);
  const samplesRef = useRef<number[]>([]);

  const liveValue = readScalar(pose, source);

  const handleRecord = useCallback(() => {
    if (recording) return;
    setRecording(true);
    setCaptured(null);
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
          setCaptured(result);
          onApply(result);
        }
      }
    }, 33);
  }, [mode, onApply, recording, source]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{label}</p>

      <LiveValueBar
        label="Live-Wert (mach die Pose jetzt)"
        value={liveValue ?? 0}
        reference={captured}
      />

      {recording ? (
        <div
          style={{
            background: '#1c1c22',
            border: '1px solid #4f46e5',
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
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
                transition: 'width 50ms linear',
              }}
            />
          </div>
        </div>
      ) : captured !== null ? (
        <div
          style={{
            background: '#0d2a1e',
            border: '1px solid #1a4d36',
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
            color: '#7af2c5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            ✓ Erfasst: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{captured.toFixed(3)}</code>
          </span>
          <button
            type="button"
            onClick={handleRecord}
            disabled={saving || !trackingReady}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #1a4d36',
              color: '#7af2c5',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Erneut aufnehmen
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={saving || !trackingReady}
          onClick={handleRecord}
          style={{ alignSelf: 'flex-start' }}
        >
          {RECORD_SECONDS}-Sek-Aufnahme starten
        </button>
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
