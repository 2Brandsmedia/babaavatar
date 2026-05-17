import { memo, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@renderer/store/settings';
import { useTrackingStore } from '@renderer/store/tracking';

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface CameraStepProps {
  onComplete?: () => void;
}

export const CameraStep = memo(function CameraStep({ onComplete }: CameraStepProps): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.update);
  const trackingEnabled = useTrackingStore((s) => s.trackingEnabled);
  const setTrackingEnabled = useTrackingStore((s) => s.setTrackingEnabled);
  const videoStream = useTrackingStore((s) => s.videoStream);
  const trackingError = useTrackingStore((s) => s.trackingError);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      const list = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      setDevices(
        list
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Kamera ${d.deviceId.slice(0, 8) || 'unbekannt'}`,
          })),
      );
    };
    void refresh();
    const onChange = (): void => void refresh();
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
    };
  }, [videoStream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  useEffect(() => {
    if (videoStream) onComplete?.();
  }, [videoStream, onComplete]);

  const currentId = settings?.selectedCameraId ?? '';
  const hasLabels = devices.some((d) => d.label && !d.label.startsWith('Kamera '));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13 }}>
        Wähle die Kamera für das Gesichts-Tracking. Die Vorschau unten zeigt den aktiven
        Tracking-Stream.
      </p>
      {trackingError && (
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
          {trackingError}
        </div>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Aktive Kamera</span>
        <select
          value={currentId}
          disabled={devices.length === 0}
          onChange={(e) => void updateSetting('selectedCameraId', e.target.value || null)}
        >
          <option value="">— Standard —</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        {!hasLabels && devices.length > 0 && (
          <small style={{ color: '#a0a0a8' }}>
            Geräte-Namen sind erst sichtbar wenn die Webcam einmal aktiviert wurde.
          </small>
        )}
      </label>
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {videoStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: settings?.mirrorMode ? 'scaleX(-1)' : 'none',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a0a0a8',
              fontSize: 13,
              textAlign: 'center',
              padding: 16,
            }}
          >
            {trackingEnabled
              ? 'Webcam wird gestartet…'
              : 'Webcam ist nicht aktiv. Aktiviere sie oben rechts in der Statusleiste oder mit dem Button unten.'}
          </div>
        )}
      </div>
      <button
        type="button"
        className="primary"
        disabled={trackingEnabled && videoStream !== null}
        onClick={() => setTrackingEnabled(true)}
      >
        {trackingEnabled && videoStream !== null ? 'Tracking läuft ✓' : 'Webcam aktivieren'}
      </button>
    </div>
  );
});
