import { memo, useEffect, useRef, useState } from 'react';
import type { AppSettings, TrackerProtocol, VmcSnapshot } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';

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

      <ConnectionStatus enabled={settings.vmcEnabled} />

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

      <SetupGuide protocol={settings.vmcProtocol} localIps={localIps} port={settings.vmcPort} />
    </div>
  );
});

interface SetupGuideProps {
  protocol: TrackerProtocol;
  localIps: string[];
  port: number;
}

const SetupGuide = memo(function SetupGuide({
  protocol,
  localIps,
  port,
}: SetupGuideProps): JSX.Element {
  const ipDisplay =
    localIps.length > 0 ? (
      <code style={{ color: '#7aa7ff', background: '#0f0f12', padding: '2px 6px', borderRadius: 4 }}>
        {localIps.join(' / ')}
      </code>
    ) : (
      <em>(keine Netzwerk-IP gefunden)</em>
    );

  return (
    <div
      style={{
        background: '#15151a',
        border: '1px solid #2a2a32',
        borderRadius: 12,
        padding: 14,
        fontSize: 12,
        color: '#a0a0a8',
        lineHeight: 1.6,
      }}
    >
      {protocol === 'ifacialmocap' ? (
        <>
          <strong style={{ color: '#cfd0d6' }}>Schnellstart mit iFacialMocap / iFacialMocapTr:</strong>
          <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>iPhone und PC im selben WLAN</li>
            <li>
              App <strong>iFacialMocap</strong> (5,99 €) oder <strong>iFacialMocapTr</strong>{' '}
              (gratis, mit Werbung) aus dem App Store
            </li>
            <li>Empfänger oben aktivieren, Port belassen ({port})</li>
            <li>
              In der iPhone-App deine PC-IP eintragen: {ipDisplay} und Port{' '}
              <code style={{ color: '#7aa7ff' }}>{port}</code>
            </li>
            <li>iPhone-App startet automatisch das Streaming, sobald BabaAvatar den
              Handshake schickt (alle 1 s).</li>
          </ol>
          <p style={{ margin: '10px 0 0 0' }}>
            <strong style={{ color: '#facc15' }}>Wichtig</strong>: das iPhone schickt
            erst Daten, nachdem BabaAvatar einen Handshake-Trigger gesendet hat. Falls
            die LED nach 10 Sekunden noch grau bleibt: Firewall auf dem PC prüfen
            (UDP-Port {port} erlauben).
          </p>
        </>
      ) : (
        <>
          <strong style={{ color: '#cfd0d6' }}>Schnellstart mit RhyLive (VMC):</strong>
          <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>iPhone und PC im selben WLAN</li>
            <li>App <strong>RhyLive</strong> (gratis, chinesische UI) aus dem App Store</li>
            <li>Empfänger oben aktivieren, Port belassen ({port})</li>
            <li>
              In RhyLive deine PC-IP eintragen: {ipDisplay} und Port{' '}
              <code style={{ color: '#7aa7ff' }}>{port}</code>
            </li>
            <li>„Send"-Button in RhyLive drücken — die LED oben wird grün</li>
          </ol>
        </>
      )}
    </div>
  );
});

interface ConnectionStatusProps {
  enabled: boolean;
}

const ConnectionStatus = memo(function ConnectionStatus({ enabled }: ConnectionStatusProps): JSX.Element {
  const ledRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const lastFrameRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((snapshot) => {
      lastFrameRef.current = snapshot;
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const last = lastFrameRef.current;
      const active = enabled && last !== null && Date.now() - last.receivedAt < 2000;
      if (ledRef.current) {
        ledRef.current.style.background = active ? '#4ade80' : enabled ? '#facc15' : '#3a3a44';
        ledRef.current.style.boxShadow = active ? '0 0 8px rgba(74,222,128,0.7)' : 'none';
      }
      if (textRef.current) {
        if (!enabled) textRef.current.textContent = 'Empfänger aus';
        else if (active) {
          const keys = Object.keys(last?.blendShapes ?? {}).length;
          textRef.current.textContent = `verbunden (${keys} BlendShapes)`;
        } else {
          textRef.current.textContent = 'wartet auf Daten…';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        ref={ledRef}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#3a3a44',
          transition: 'background 80ms linear, box-shadow 80ms linear',
        }}
      />
      <span ref={textRef} style={{ fontSize: 13, color: '#cfd0d6' }}>
        Empfänger aus
      </span>
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
