import { memo, useCallback, useEffect, useState } from 'react';
import type { AppSettings, MaxineCamera, MaxineStatus } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';

interface MaxineSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const STATUS_POLL_MS = 2000;

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #3a3a44',
  background: '#26262e',
  color: '#e8e8ec',
  cursor: 'pointer',
};

export const MaxineSettings = memo(function MaxineSettings({
  settings,
  onUpdate,
}: MaxineSettingsProps): JSX.Element {
  const [status, setStatus] = useState<MaxineStatus | null>(null);
  const [cameras, setCameras] = useState<MaxineCamera[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = (): void => {
      void api.maxine
        .status()
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch(() => undefined);
    };
    poll();
    const interval = window.setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handlePickExe = useCallback(async () => {
    const picked = await api.maxine.pickExe().catch(() => null);
    if (picked) await onUpdate('maxineExePath', picked);
  }, [onUpdate]);

  const handleListCameras = useCallback(async () => {
    setBusy(true);
    setCameraError(null);
    try {
      const list = await api.maxine.listCameras();
      setCameras(list);
      if (list.length === 0) setCameraError('Keine Kameras gefunden.');
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Kamera-Suche fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCameraChange = useCallback(
    async (cameraId: number) => {
      await onUpdate('maxineCameraIndex', cameraId);
      const camera = cameras.find((c) => c.id === cameraId);
      const best = camera ? pickBestMode(camera) : null;
      if (best) {
        await onUpdate('maxineCameraCap', best.id);
        await onUpdate('maxineCamRes', `${best.width}x${best.height}`);
        await onUpdate('maxineCamFps', best.fps);
      }
    },
    [cameras, onUpdate],
  );

  const selectedCamera = cameras.find((c) => c.id === settings.maxineCameraIndex) ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        border: '1px solid #2a2a32',
        background: '#1c1c22',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>NVIDIA Maxine (ExpressionApp)</span>
        <StatusPill status={status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={buttonStyle} onClick={() => void handlePickExe()}>
          ExpressionApp.exe wählen…
        </button>
        <span
          style={{
            fontSize: 11,
            color: settings.maxineExePath ? '#a0a0a8' : '#e0a040',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {settings.maxineExePath ?? 'Noch kein Pfad gesetzt'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={busy || !settings.maxineExePath}
          onClick={() => void handleListCameras()}
        >
          {busy ? 'Suche Kameras…' : 'Kameras suchen'}
        </button>
        <button
          type="button"
          style={buttonStyle}
          disabled={!status?.running}
          onClick={() => void api.maxine.calibrate()}
        >
          Neutral-Pose kalibrieren
        </button>
      </div>

      {cameras.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13 }}>Maxine-Kamera</span>
          <select
            value={settings.maxineCameraIndex}
            onChange={(e) => void handleCameraChange(Number(e.target.value))}
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedCamera && selectedCamera.modes.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13 }}>Kamera-Modus</span>
          <select
            value={settings.maxineCameraCap}
            onChange={(e) => {
              const mode = selectedCamera.modes.find((m) => m.id === Number(e.target.value));
              if (!mode) return;
              void onUpdate('maxineCameraCap', mode.id);
              void onUpdate('maxineCamRes', `${mode.width}x${mode.height}`);
              void onUpdate('maxineCamFps', mode.fps);
            }}
          >
            {selectedCamera.modes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.width}×{mode.height} @ {mode.fps} FPS
              </option>
            ))}
          </select>
        </label>
      )}

      {cameraError && <small style={{ color: '#e05050', fontSize: 11 }}>{cameraError}</small>}
      {status?.error && <small style={{ color: '#e05050', fontSize: 11 }}>{status.error}</small>}

      <small style={{ color: '#6a6a72', fontSize: 11, lineHeight: 1.5 }}>
        Die ExpressionApp öffnet die Kamera exklusiv. Wenn Webcam-Körper-Tracking (MediaPipe)
        parallel laufen soll, dort eine ANDERE Kamera wählen — sonst blockieren sich beide.
        Nach dem Start ca. 10 Sekunden neutral in die Kamera schauen und dann
        {' „Neutral-Pose kalibrieren“ '}klicken.
      </small>
    </div>
  );
});

function pickBestMode(camera: MaxineCamera): MaxineCamera['modes'][number] | null {
  // Bevorzugt 1280x720 mit der höchsten FPS, sonst der Modus mit den meisten Pixeln bei ≥30 FPS.
  const hd = camera.modes
    .filter((m) => m.width === 1280 && m.height === 720)
    .sort((a, b) => b.fps - a.fps)[0];
  if (hd) return hd;
  const sorted = [...camera.modes].sort(
    (a, b) => b.width * b.height * Math.min(b.fps, 60) - a.width * a.height * Math.min(a.fps, 60),
  );
  return sorted[0] ?? null;
}

const StatusPill = memo(function StatusPill({ status }: { status: MaxineStatus | null }): JSX.Element {
  let color = '#6a6a72';
  let text = 'unbekannt';
  if (status) {
    if (!status.available) {
      color = '#6a6a72';
      text = 'nur Windows';
    } else if (status.running) {
      const fresh = Date.now() - status.lastMessageAt < 3000;
      color = fresh ? '#40c060' : '#e0a040';
      text = fresh ? `läuft (${status.packetsReceived} Pakete)` : 'läuft, keine Daten';
    } else {
      color = '#e05050';
      text = 'gestoppt';
    }
  }
  return (
    <span
      style={{
        fontSize: 11,
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '2px 8px',
      }}
    >
      {text}
    </span>
  );
});
