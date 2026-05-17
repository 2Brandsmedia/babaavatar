import { memo, useEffect, useRef } from 'react';
import type { AvatarRecord, VmcSnapshot } from '@shared/types';
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

const TrackerIndicator = memo(function TrackerIndicator(): JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings);
  const dotRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const lastFrameRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((snapshot) => {
      lastFrameRef.current = snapshot;
    });
    return () => unsubscribe();
  }, []);

  const enabled = settings?.vmcEnabled ?? false;
  const protocol = settings?.vmcProtocol ?? 'ifacialmocap';
  const protocolLabel = protocol === 'ifacialmocap' ? 'iFacialMocap' : 'VMC';

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = (): void => {
      const last = lastFrameRef.current;
      const active = last !== null && Date.now() - last.receivedAt < 2000;
      if (dotRef.current) {
        dotRef.current.style.background = active ? '#7af2c5' : '#facc15';
      }
      if (labelRef.current) {
        if (active) {
          const keys = Object.keys(last?.blendShapes ?? {}).length;
          labelRef.current.textContent = `${protocolLabel} · ${keys} BlendShapes`;
          labelRef.current.style.color = '#e8e8ec';
        } else {
          labelRef.current.textContent = `${protocolLabel} · wartet`;
          labelRef.current.style.color = '#a0a0a8';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, protocolLabel]);

  if (!enabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: '#52525a' }} />
        <span style={{ color: '#a0a0a8' }}>Tracker:</span>
        <span style={{ color: '#6a6a72' }}>Aus</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        ref={dotRef}
        style={{ width: 8, height: 8, borderRadius: 999, background: '#facc15' }}
      />
      <span style={{ color: '#a0a0a8' }}>Tracker:</span>
      <span ref={labelRef} style={{ color: '#a0a0a8' }}>
        {protocolLabel} · wartet
      </span>
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
