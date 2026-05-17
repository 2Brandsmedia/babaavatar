import { memo, useEffect, useRef, useState } from 'react';
import type { AppSettings, VmcSnapshot } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';

interface ExternalTrackerSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8' }}>
        Empfange Tracking-Daten von externen Apps via VMC (Virtual Motion Capture) auf einem
        UDP-Port. Kompatibel mit RhyLive (iPhone, kostenlos), iFacialMocap, MeowFace,
        VirtualMotionCapture, SlimeVR-Bridge u.a.
      </p>

      <ToggleRow
        label="VMC-Empfänger aktiv"
        value={settings.vmcEnabled}
        onChange={(v) => void onUpdate('vmcEnabled', v)}
      />

      <ConnectionStatus enabled={settings.vmcEnabled} />

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13 }}>UDP-Port (Standard: 39539)</span>
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
        <span style={{ fontSize: 13, color: '#cfd0d6' }}>Daten-Quellen aus VMC</span>
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
        <strong style={{ color: '#cfd0d6' }}>Schnellstart mit iPhone (RhyLive, gratis):</strong>
        <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
          <li>iPhone und PC im selben WLAN</li>
          <li>App "RhyLive" aus dem App Store installieren (kostenlos)</li>
          <li>VMC-Empfänger oben aktivieren, Port belassen ({settings.vmcPort})</li>
          <li>
            In RhyLive deine PC-IP eintragen:{' '}
            {localIps.length > 0 ? (
              <code style={{ color: '#7aa7ff', background: '#0f0f12', padding: '2px 6px', borderRadius: 4 }}>
                {localIps.join(' / ')}
              </code>
            ) : (
              <em>(keine Netzwerk-IP gefunden)</em>
            )}{' '}
            und Port <code style={{ color: '#7aa7ff' }}>{settings.vmcPort}</code>
          </li>
          <li>"Send"-Button in RhyLive drücken – die LED oben wird grün</li>
        </ol>
      </div>
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
