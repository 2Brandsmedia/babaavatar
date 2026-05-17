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
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(async (s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setPreviewStream(s);
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        setDevices(
          list
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Kamera ${d.deviceId.slice(0, 8)}`,
            })),
        );
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Kamera-Zugriff verweigert');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      previewStream?.getTracks().forEach((t) => t.stop());
    };
  }, [previewStream]);

  useEffect(() => {
    if (videoRef.current && previewStream) videoRef.current.srcObject = previewStream;
  }, [previewStream]);

  useEffect(() => {
    if (previewStream && devices.length > 0) onComplete?.();
  }, [previewStream, devices.length, onComplete]);

  const currentId = settings?.selectedCameraId ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0 }}>
        Wähle die Kamera, die für das Gesichts-Tracking genutzt werden soll. Die Vorschau zeigt
        live, was die App sieht.
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
      </div>
      <button
        type="button"
        className="primary"
        disabled={trackingEnabled}
        onClick={() => setTrackingEnabled(true)}
      >
        {trackingEnabled ? 'Tracking läuft ✓' : 'Tracking starten'}
      </button>
    </div>
  );
});
