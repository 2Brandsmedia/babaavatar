import { memo, useEffect, useRef, useState } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { TrackingOverlay } from '@renderer/components/webcam-preview/TrackingOverlay';
import { PerformanceProfiler } from '@renderer/components/profiler/PerformanceProfiler';

export const TrackingPanel = memo(function TrackingPanel(): JSX.Element {
  const {
    videoStream,
    pose,
    metrics,
    trackingReady,
    trackingError,
    lipsyncReady,
    lipsyncError,
    cameraId,
    microphoneId,
    setCameraId,
    setMicrophoneId,
    trackingEnabled,
    lipsyncEnabled,
  } = useTrackingStore();
  const { settings } = useSettingsStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = videoStream;
  }, [videoStream]);

  useEffect(() => {
    const update = (): void => {
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        setCameras(devices.filter((d) => d.kind === 'videoinput'));
        setMicrophones(devices.filter((d) => d.kind === 'audioinput'));
      });
    };
    update();
    navigator.mediaDevices.addEventListener('devicechange', update);
    return () => navigator.mediaDevices.removeEventListener('devicechange', update);
  }, []);

  const mirror = settings?.mirrorMode ?? true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <header>
        <h2 style={{ margin: 0 }}>Live-Tracking</h2>
        <p style={{ color: '#a0a0a8', margin: '4px 0 0 0' }}>
          Das Tracking läuft im Hintergrund — egal in welcher Sektion du bist. Hier siehst du Webcam-Bild und Status.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          background: '#1c1c22',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #2a2a32',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#a0a0a8' }}>Kamera</span>
          <select
            value={cameraId ?? ''}
            onChange={(e) => setCameraId(e.target.value || null)}
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Standard-Kamera</option>
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Kamera ${c.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#a0a0a8' }}>Mikrofon</span>
          <select
            value={microphoneId ?? ''}
            onChange={(e) => setMicrophoneId(e.target.value || null)}
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Standard-Mikrofon</option>
            {microphones.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Mikrofon ${m.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
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
            transform: mirror ? 'scaleX(-1)' : 'none',
            display: trackingEnabled ? 'block' : 'none',
          }}
        />
        <TrackingOverlay pose={pose} mirror={mirror} />
        {!trackingEnabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a0a0a8',
            }}
          >
            Webcam ist aus. Oben rechts einschalten.
          </div>
        )}
      </div>

      <div
        style={{
          background: '#15151a',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #2a2a32',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          color: '#7af2c5',
        }}
      >
        <div>Tracking-Engine: {trackingReady ? 'aktiv' : 'inaktiv'}</div>
        <div>FPS: {metrics.fps}</div>
        <div>Latenz Ø: {metrics.averageLatencyMs.toFixed(1)} ms</div>
        <div>Frames: {metrics.framesProcessed}</div>
        <div>Drops: {metrics.droppedFrames}</div>
        {trackingError && <div style={{ color: '#ff7878' }}>Tracking-Fehler: {trackingError}</div>}
        <div>Lipsync: {lipsyncReady ? 'aktiv' : lipsyncEnabled ? 'startet…' : 'aus'}</div>
        {lipsyncError && <div style={{ color: '#ff7878' }}>Lipsync-Fehler: {lipsyncError}</div>}
      </div>

      <PerformanceProfiler />
    </div>
  );
});
