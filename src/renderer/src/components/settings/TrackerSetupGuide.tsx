import { memo } from 'react';
import type { TrackerProtocol } from '@shared/types';

interface TrackerSetupGuideProps {
  protocol: TrackerProtocol;
  localIps: string[];
  port: number;
}

export const TrackerSetupGuide = memo(function TrackerSetupGuide({
  protocol,
  localIps,
  port,
}: TrackerSetupGuideProps): JSX.Element {
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
            <li>
              iPhone-App startet automatisch das Streaming, sobald BabaAvatar den Handshake
              schickt (alle 1 s).
            </li>
          </ol>
          <p style={{ margin: '10px 0 0 0' }}>
            <strong style={{ color: '#facc15' }}>Wichtig</strong>: das iPhone schickt erst Daten,
            nachdem BabaAvatar einen Handshake-Trigger gesendet hat. Falls die LED nach 10
            Sekunden noch grau bleibt: Firewall auf dem PC prüfen (UDP-Port {port} erlauben).
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
            <li>„Send"-Button in RhyLive drücken, die LED oben wird grün</li>
          </ol>
        </>
      )}
    </div>
  );
});
