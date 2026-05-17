import { memo, useEffect, useRef, useState } from 'react';
import type { AvatarRecord, TrackingSource, VmcSnapshot } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { api } from '@renderer/lib/ipc/api';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';

interface StatusBarProps {
  activeAvatar: AvatarRecord | null;
}

export const StatusBar = memo(function StatusBar({ activeAvatar }: StatusBarProps): JSX.Element {
  const {
    trackingEnabled,
    setTrackingEnabled,
    lipsyncEnabled,
    setLipsyncEnabled,
    trackingReady,
    trackingError,
    metrics,
  } = useTrackingStore();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 16px',
        background: '#15151a',
        borderBottom: '1px solid #2a2a32',
        fontSize: 12,
      }}
    >
      <Indicator
        label={activeAvatar ? activeAvatar.displayName : 'Kein Avatar gewählt'}
        prefix="Avatar"
        active={!!activeAvatar}
      />
      <SourceSelector />
      <Indicator
        label={
          trackingReady
            ? `${metrics.fps} FPS · ${metrics.averageLatencyMs.toFixed(0)} ms`
            : trackingError
              ? 'Fehler'
              : trackingEnabled
                ? 'Startet…'
                : 'Aus'
        }
        prefix="Webcam"
        active={trackingReady}
      />
      <TrackerIndicator />
      {trackingError && (
        <span style={{ color: '#ff7878', fontSize: 11 }}>{trackingError}</span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <ToggleButton
          label="Webcam"
          active={trackingEnabled}
          onClick={() => setTrackingEnabled(!trackingEnabled)}
        />
        <ToggleButton
          label="Mikrofon"
          active={lipsyncEnabled}
          onClick={() => setLipsyncEnabled(!lipsyncEnabled)}
        />
        <button type="button" onClick={() => void api.output.open()}>
          Output zeigen
        </button>
      </div>
    </div>
  );
});

const SourceSelector = memo(function SourceSelector(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setTrackingEnabled = useTrackingStore((s) => s.setTrackingEnabled);
  const source = settings?.trackingSource ?? 'webcam';

  const handleChange = (next: TrackingSource): void => {
    if (next === source) return;
    void update('trackingSource', next);
    const wantsWebcam = next === 'webcam' || next === 'both';
    const wantsExternal = next === 'external' || next === 'both';
    setTrackingEnabled(wantsWebcam);
    void update('vmcEnabled', wantsExternal);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#a0a0a8' }}>Quelle:</span>
      <div style={{ display: 'flex', border: '1px solid #2a2a32', borderRadius: 6, overflow: 'hidden' }}>
        <SourceButton label="Webcam" active={source === 'webcam'} onClick={() => handleChange('webcam')} />
        <SourceButton label="iPhone" active={source === 'external'} onClick={() => handleChange('external')} />
        <SourceButton label="Beides" active={source === 'both'} onClick={() => handleChange('both')} />
      </div>
    </div>
  );
});

interface SourceButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const SourceButton = memo(function SourceButton({ label, active, onClick }: SourceButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? '#22223a' : '#0f0f12',
        color: active ? '#7aa7ff' : '#a0a0a8',
        border: 'none',
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
});

const TrackerIndicator = memo(function TrackerIndicator(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const [snapshot, setSnapshot] = useState<VmcSnapshot | null>(null);
  const lastFrameRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((s) => {
      lastFrameRef.current = s;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot(lastFrameRef.current);
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const enabled = settings?.vmcEnabled ?? false;
  const protocol = settings?.vmcProtocol ?? 'ifacialmocap';
  const protocolLabel = protocol === 'ifacialmocap' ? 'iFacialMocap' : 'VMC';
  const fresh = snapshot !== null && Date.now() - snapshot.receivedAt < 2000;
  const active = enabled && fresh;

  let dotColor = '#52525a';
  if (enabled) dotColor = active ? '#7af2c5' : '#facc15';

  let label = 'Aus';
  if (enabled) {
    if (active) {
      const keys = Object.keys(snapshot?.blendShapes ?? {}).length;
      label = `${protocolLabel} · ${keys} BlendShapes`;
    } else {
      label = `${protocolLabel} · wartet`;
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor }} />
      <span style={{ color: '#a0a0a8' }}>Tracker:</span>
      <span style={{ color: enabled && active ? '#e8e8ec' : '#6a6a72' }}>{label}</span>
    </div>
  );
});

interface IndicatorProps {
  prefix: string;
  label: string;
  active: boolean;
}

const Indicator = memo(function Indicator({ prefix, label, active }: IndicatorProps): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: active ? '#7af2c5' : '#52525a',
        }}
      />
      <span style={{ color: '#a0a0a8' }}>{prefix}:</span>
      <span style={{ color: active ? '#e8e8ec' : '#6a6a72' }}>{label}</span>
    </div>
  );
});

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const ToggleButton = memo(function ToggleButton({
  label,
  active,
  onClick,
}: ToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} ${active ? 'ausschalten' : 'einschalten'}`}
      style={{
        background: active ? '#1c3b22' : '#1c1c22',
        border: `1px solid ${active ? '#7af2c5' : '#2a2a32'}`,
        color: active ? '#7af2c5' : '#a0a0a8',
        fontSize: 11,
        padding: '4px 10px',
      }}
    >
      {label}: {active ? 'AN' : 'AUS'}
    </button>
  );
});
