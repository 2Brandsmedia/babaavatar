import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';

const RECORD_SECONDS = 8;

interface HandsStepProps {
  onConfirmed?: () => void;
}

export const HandsStep = memo(function HandsStep({ onConfirmed }: HandsStepProps): JSX.Element {
  const rawLandmarksRef = useTrackingStore((s) => s.rawLandmarksRef);
  const pose = useTrackingStore((s) => s.pose);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const seenRef = useRef({ hands: false, left: false, right: false });
  const intervalRef = useRef<number | null>(null);

  const handsCount = rawLandmarksRef.current?.hands.length ?? 0;
  const armsLeft = pose?.pose?.armsVisible.left ?? false;
  const armsRight = pose?.pose?.armsVisible.right ?? false;

  const handleStart = useCallback(() => {
    if (recording) return;
    setRecording(true);
    setConfirmed(false);
    seenRef.current = { hands: false, left: false, right: false };
    const start = performance.now();
    intervalRef.current = window.setInterval(() => {
      const state = useTrackingStore.getState();
      const handsC = state.rawLandmarksRef.current?.hands.length ?? 0;
      const l = state.pose?.pose?.armsVisible.left ?? false;
      const r = state.pose?.pose?.armsVisible.right ?? false;
      if (handsC > 0) seenRef.current.hands = true;
      if (l) seenRef.current.left = true;
      if (r) seenRef.current.right = true;

      const elapsed = (performance.now() - start) / 1000;
      setProgress(Math.min(elapsed / RECORD_SECONDS, 1));

      const allSeen = seenRef.current.hands && seenRef.current.left && seenRef.current.right;
      if (allSeen || elapsed >= RECORD_SECONDS) {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setRecording(false);
        setProgress(0);
        if (allSeen) {
          setConfirmed(true);
          onConfirmed?.();
        }
      }
    }, 100);
  }, [recording, onConfirmed]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const handleSkip = useCallback(() => {
    setConfirmed(true);
    onConfirmed?.();
  }, [onConfirmed]);

  const seenHands = recording ? seenRef.current.hands : handsCount > 0;
  const seenLeft = recording ? seenRef.current.left : armsLeft;
  const seenRight = recording ? seenRef.current.right : armsRight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        Test des Hand- und Arm-Trackings. Starte die Aufnahme und führe in den 8 Sekunden:
        beide Hände nacheinander vor die Kamera, dann linker Arm hoch, dann rechter Arm hoch.
        Sobald alle drei Karten grün waren, wird der Schritt automatisch bestätigt.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          fontSize: 13,
        }}
      >
        <StatusCard label="Hände erkannt" value={seenHands ? '✓' : '–'} ok={seenHands} />
        <StatusCard label="Linker Arm" value={seenLeft ? '✓' : '–'} ok={seenLeft} />
        <StatusCard label="Rechter Arm" value={seenRight ? '✓' : '–'} ok={seenRight} />
      </div>

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
          Aufnahme läuft… {Math.round(progress * 100)}%
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
                width: `${progress * 100}%`,
                background: '#7aa7ff',
                height: '100%',
                transition: 'width 100ms linear',
              }}
            />
          </div>
        </div>
      ) : confirmed ? (
        <div
          style={{
            background: '#0d2a1e',
            border: '1px solid #1a4d36',
            padding: 12,
            borderRadius: 8,
            color: '#7af2c5',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>✓ Hand- und Arm-Tracking bestätigt</span>
          <button
            type="button"
            onClick={handleStart}
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
            Erneut prüfen
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="primary"
            onClick={handleStart}
            style={{ flex: '1 1 auto' }}
          >
            {RECORD_SECONDS}-Sek-Aufnahme starten
          </button>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: '1px solid #2a2a32',
              color: '#a0a0a8',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Überspringen
          </button>
        </div>
      )}

      <small style={{ color: '#a0a0a8' }}>
        Wenn deine Hand-Bewegung am Avatar verkehrt herum ankommt: im Tracking-Tab den
        Spiegel-Modus toggeln. Falls deine Webcam die Hände nicht erfassen kann, einfach
        überspringen.
      </small>
    </div>
  );
});

interface StatusCardProps {
  label: string;
  value: string;
  ok: boolean;
}

const StatusCard = memo(function StatusCard({ label, value, ok }: StatusCardProps): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: ok ? '#0d2a1e' : '#1c1c22',
        border: `1px solid ${ok ? '#1a4d36' : '#2a2a32'}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: '#a0a0a8' }}>{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: ok ? '#7af2c5' : '#4a4a52',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
});
