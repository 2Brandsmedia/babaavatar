import { memo } from 'react';
import type { AvatarRecord } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { api } from '@renderer/lib/ipc/api';

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
