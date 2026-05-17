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
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshDevices = async (): Promise<void> => {
      try {
        if (!permissionGranted && !trackingEnabled) {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach((t) => t.stop());
          if (cancelled) return;
          setPermissionGranted(true);
        }
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDevices(
          list
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Kamera ${d.deviceId.slice(0, 8)}`,
            })),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kamera-Zugriff verweigert');
        }
      }
    };
    void refreshDevices();
    return () => {
      cancelled = true;
    };
  }, [permissionGranted, trackingEnabled]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  useEffect(() => {
    if (videoStream && devices.length > 0) onComplete?.();
  }, [videoStream, devices.length, onComplete]);

  const currentId = settings?.selectedCameraId ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13 }}>
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
            Webcam ist nicht aktiv. Klick auf „Tracking starten" unten oder oben in der Statusleiste „Webcam: AUS".
          </div>
        )}
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
