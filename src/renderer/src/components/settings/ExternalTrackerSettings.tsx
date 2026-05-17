import { memo, useEffect, useState } from 'react';
import type { AppSettings, TrackerProtocol } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { TrackerConnectionStatus } from './TrackerConnectionStatus';
import { TrackerSetupGuide } from './TrackerSetupGuide';
import { TrackerDebugPanel } from './TrackerDebugPanel';

interface ExternalTrackerSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const PROTOCOL_DEFAULT_PORT: Record<TrackerProtocol, number> = {
  vmc: 39539,
  ifacialmocap: 49983,
};

export const ExternalTrackerSettings = memo(function ExternalTrackerSettings({
  settings,
  onUpdate,
}: ExternalTrackerSettingsProps): JSX.Element {
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [portInput, setPortInput] = useState(String(settings.vmcPort));

  useEffect(() => {
    void api.vmc.localIps().then(setLocalIps);
  }, []);

  useEffect(() => {
    setPortInput(String(settings.vmcPort));
  }, [settings.vmcPort]);

  const commitPort = (): void => {
    const parsed = Number.parseInt(portInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1024 || parsed > 65535) {
      setPortInput(String(settings.vmcPort));
      return;
    }
    if (parsed !== settings.vmcPort) {
      void onUpdate('vmcPort', parsed);
    }
  };

  const handleProtocolChange = (next: TrackerProtocol): void => {
    void onUpdate('vmcProtocol', next);
    const targetPort = PROTOCOL_DEFAULT_PORT[next];
    if (settings.vmcPort !== targetPort) {
      void onUpdate('vmcPort', targetPort);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8' }}>
        Empfange Tracking-Daten von einer iPhone-App auf einem UDP-Port. Zwei Protokolle
        werden unterstützt: <strong>iFacialMocap</strong> (proprietär, Standard für iPhone)
        und <strong>VMC</strong> (Virtual Motion Capture, von RhyLive, VirtualMotionCapture,
        SlimeVR-Bridge u.a. genutzt).
      </p>

      <ToggleRow
        label="Empfänger aktiv"
        value={settings.vmcEnabled}
        onChange={(v) => void onUpdate('vmcEnabled', v)}
      />

      <TrackerConnectionStatus enabled={settings.vmcEnabled} />

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>Protokoll</span>
        <select
          value={settings.vmcProtocol}
          onChange={(e) => handleProtocolChange(e.target.value as TrackerProtocol)}
        >
          <option value="ifacialmocap">iFacialMocap / iFacialMocapTr (iPhone, Port 49983)</option>
          <option value="vmc">VMC Standard (RhyLive, VirtualMotionCapture, Port 39539)</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>UDP-Port</span>
        <input
          type="number"
          value={portInput}
          min={1024}
          max={65535}
          onChange={(e) => setPortInput(e.target.value)}
          onBlur={commitPort}
          style={{
            padding: 6,
            borderRadius: 6,
            border: '1px solid #2a2a32',
            background: '#0f0f12',
            color: '#e8e8ec',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
            width: 140,
          }}
        />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: '#cfd0d6' }}>Daten-Quellen</span>
        <ToggleRow
          label="Face-BlendShapes (52 ARKit-Werte: Mund, Augen, Brauen, …)"
          value={settings.vmcSourceFace}
          onChange={(v) => void onUpdate('vmcSourceFace', v)}
        />
        <ToggleRow
          label="Head-Rotation (Kopf-Bewegung)"
          value={settings.vmcSourceHead}
          onChange={(v) => void onUpdate('vmcSourceHead', v)}
        />
      </div>

      <TrackerSetupGuide
        protocol={settings.vmcProtocol}
        localIps={localIps}
        port={settings.vmcPort}
      />

      <TrackerDebugPanel enabled={settings.vmcEnabled} />
    </div>
  );
});

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow = memo(function ToggleRow({ label, value, onChange }: ToggleRowProps): JSX.Element {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
});
