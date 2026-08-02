import { memo, useEffect, useRef, useState } from 'react';
import type { PoseFrame } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { api } from '@renderer/lib/ipc/api';

const REFRESH_MS = 150;
const DUMP_DURATION_MS = 5000;
const DUMP_SAMPLE_MS = 50;

// Live-Diagnose: zeigt, WARUM sich ein Glied nicht bewegt (Gate zu? Confidence
// im Keller? Werte kommen an, aber winzig?). Werte aktualisieren gedrosselt,
// damit das Panel den Hot-Path nicht belastet.
export const TrackingDiagnostics = memo(function TrackingDiagnostics(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PoseFrame | null>(null);
  const metrics = useTrackingStore((s) => s.metrics);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => {
      setSnapshot(useTrackingStore.getState().pose);
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [open]);

  return (
    <div
      style={{
        border: '1px solid #2a2a32',
        borderRadius: 8,
        background: '#17171c',
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          color: '#a0a0a8',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {open ? '▾' : '▸'} Tracking-Diagnose (Debug)
      </button>
      {open && (
        <>
          <PoseDumpButton />
          <DiagnosticsBody frame={snapshot} fps={metrics.fps} />
        </>
      )}
    </div>
  );
});

// Zeichnet 5 Sekunden PoseFrames als JSON auf (userData/recordings/) —
// damit lassen sich Bewegungsprobleme an echten Zahlen analysieren statt raten.
const PoseDumpButton = memo(function PoseDumpButton(): JSX.Element {
  const [state, setState] = useState<'idle' | 'recording' | 'saved' | 'error'>('idle');
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);

  const start = (): void => {
    setState('recording');
    framesRef.current = [];
    const interval = window.setInterval(() => {
      const pose = useTrackingStore.getState().pose;
      if (pose) framesRef.current.push(pose);
    }, DUMP_SAMPLE_MS);
    window.setTimeout(() => {
      window.clearInterval(interval);
      const json = JSON.stringify(
        { recordedAt: new Date().toISOString(), frames: framesRef.current },
        null,
        1,
      );
      const buffer = new TextEncoder().encode(json).buffer as ArrayBuffer;
      void api.recording
        .save({ buffer, mimeType: 'application/json' })
        .then((result) => {
          setSavedPath(result.filePath);
          setState('saved');
        })
        .catch(() => setState('error'));
    }, DUMP_DURATION_MS);
  };

  return (
    <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={start}
        disabled={state === 'recording'}
        style={{
          padding: '5px 10px',
          fontSize: 11,
          borderRadius: 6,
          border: '1px solid #3a3a44',
          background: state === 'recording' ? '#3b1c1c' : '#26262e',
          color: state === 'recording' ? '#ff7878' : '#e8e8ec',
          cursor: state === 'recording' ? 'wait' : 'pointer',
        }}
      >
        {state === 'recording' ? '● zeichnet 5 s auf…' : '5 s Tracking-Daten aufzeichnen'}
      </button>
      {state === 'saved' && savedPath && (
        <span style={{ fontSize: 10, color: '#7af2c5', wordBreak: 'break-all' }}>
          Gespeichert: {savedPath}
        </span>
      )}
      {state === 'error' && (
        <span style={{ fontSize: 10, color: '#ff7878' }}>Speichern fehlgeschlagen</span>
      )}
    </div>
  );
});

function DiagnosticsBody({ frame, fps }: { frame: PoseFrame | null; fps: number }): JSX.Element {
  if (!frame?.pose) {
    return (
      <p style={{ margin: 0, padding: '0 12px 10px', color: '#e0a040' }}>
        Kein Pose-Frame — Webcam an? Tracking gestartet?
      </p>
    );
  }
  const p = frame.pose;
  const age = Math.round(performance.now() - frame.timestamp);
  return (
    <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#6a6a72' }}>
        Tracking {fps} FPS · Frame-Alter {age} ms · Qualität{' '}
        {frame.quality ? `${(frame.quality.qualityScore * 100).toFixed(0)} %` : '—'} (↑ besser)
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ color: '#6a6a72', textAlign: 'left' }}>
            <th style={cell}>Glied</th>
            <th style={cell}>Aktiv?</th>
            <th style={cell}>Confidence ↑</th>
            <th style={cell}>Rotation (x/y/z rad)</th>
          </tr>
        </thead>
        <tbody>
          <LimbRow
            name="Arm links (oben)"
            active={p.armsVisible.left}
            confidence={p.armConfidence.left}
            vec={p.leftUpperArm}
          />
          <LimbRow
            name="Arm links (unten)"
            active={p.armsVisible.left}
            confidence={p.armConfidence.left}
            vec={p.leftLowerArm}
          />
          <LimbRow
            name="Arm rechts (oben)"
            active={p.armsVisible.right}
            confidence={p.armConfidence.right}
            vec={p.rightUpperArm}
          />
          <LimbRow
            name="Arm rechts (unten)"
            active={p.armsVisible.right}
            confidence={p.armConfidence.right}
            vec={p.rightLowerArm}
          />
          <LimbRow
            name="Bein links"
            active={p.legsVisible.left}
            confidence={p.legConfidence.left}
            vec={p.leftUpperLeg}
          />
          <LimbRow
            name="Bein rechts"
            active={p.legsVisible.right}
            confidence={p.legConfidence.right}
            vec={p.rightUpperLeg}
          />
          <LimbRow name="Wirbelsäule" active confidence={null} vec={p.spine} />
          <LimbRow name="Hüfte (Rotation)" active confidence={null} vec={p.hipsRotation} />
        </tbody>
      </table>
      <div style={{ color: '#6a6a72' }}>
        Hände: links {frame.hands?.left ? '✓ erkannt' : '— fehlt'} · rechts{' '}
        {frame.hands?.right ? '✓ erkannt' : '— fehlt'} · IK-Punkte: L{' '}
        {p.leftArmWorld?.visible ? '✓' : '—'} / R {p.rightArmWorld?.visible ? '✓' : '—'}
      </div>
      <p style={{ margin: 0, color: '#6a6a72', lineHeight: 1.5 }}>
        Lesehilfe: Steht „Aktiv?“ auf NEIN, wird das Glied bewusst in Ruhepose gehalten —
        Ursache ist fast immer eine niedrige Confidence (Glied am Bildrand/verdeckt).
        Bewegt sich ein Glied trotz „JA“ kaum, sind die Rotationswerte klein → Dämpfer/Mapping.
      </p>
    </div>
  );
}

const cell: React.CSSProperties = { padding: '3px 8px 3px 0', borderBottom: '1px solid #22222a' };

const LimbRow = memo(function LimbRow({
  name,
  active,
  confidence,
  vec,
}: {
  name: string;
  active: boolean;
  confidence: number | null;
  vec: { x: number; y: number; z: number } | null;
}): JSX.Element {
  return (
    <tr style={{ color: '#c8c8d0' }}>
      <td style={cell}>{name}</td>
      <td style={{ ...cell, color: active ? '#7af2c5' : '#ff7878', fontWeight: 600 }}>
        {active ? 'JA' : 'NEIN'}
      </td>
      <td style={{ ...cell, color: confColor(confidence) }}>
        {confidence === null ? '—' : `${(confidence * 100).toFixed(0)} %`}
      </td>
      <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
        {vec ? `${vec.x.toFixed(2)} / ${vec.y.toFixed(2)} / ${vec.z.toFixed(2)}` : '—'}
      </td>
    </tr>
  );
});

function confColor(confidence: number | null): string {
  if (confidence === null) return '#6a6a72';
  if (confidence >= 0.7) return '#7af2c5';
  if (confidence >= 0.4) return '#e0a040';
  return '#ff7878';
}
