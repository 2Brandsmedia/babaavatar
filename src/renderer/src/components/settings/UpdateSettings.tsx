import { memo, useEffect, useState } from 'react';
import { api } from '@renderer/lib/ipc/api';
import { useUpdaterStore } from '@renderer/store/updater';

type CheckState = 'idle' | 'checking' | 'up-to-date' | 'error';

export const UpdateSettings = memo(function UpdateSettings(): JSX.Element {
  const [version, setVersion] = useState<string>('…');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const updaterPhase = useUpdaterStore((s) => s.phase);
  const availableVersion = useUpdaterStore((s) => s.version);

  useEffect(() => {
    void api.app
      .getVersion()
      .then(setVersion)
      .catch(() => setVersion('unbekannt'));
  }, []);

  useEffect(() => {
    const unsubChecking = api.on(api.ipcChannels.UPDATER_CHECKING, () => {
      setCheckState('checking');
      setErrorMessage(null);
    });
    const unsubNone = api.on(api.ipcChannels.UPDATER_NOT_AVAILABLE, () => {
      setCheckState('up-to-date');
    });
    const unsubError = api.on<{ message: string }>(api.ipcChannels.UPDATER_ERROR, (payload) => {
      setCheckState('error');
      setErrorMessage(payload.message);
    });
    return () => {
      unsubChecking();
      unsubNone();
      unsubError();
    };
  }, []);

  const handleCheck = (): void => {
    setCheckState('checking');
    setErrorMessage(null);
    void api.updater.check().catch(() => {
      setCheckState('error');
      setErrorMessage('Update-Prüfung konnte nicht gestartet werden.');
    });
  };

  let statusText: string | null = null;
  let statusColor = '#a0a0a8';
  if (updaterPhase === 'available' || updaterPhase === 'downloading') {
    statusText = `Update auf Version ${availableVersion ?? '?'} verfügbar — Dialog ist geöffnet.`;
    statusColor = '#7af2c5';
  } else if (updaterPhase === 'downloaded') {
    statusText = `Version ${availableVersion ?? '?'} ist heruntergeladen — Installation beim Neustart.`;
    statusColor = '#7af2c5';
  } else if (checkState === 'checking') {
    statusText = 'Suche nach Updates…';
  } else if (checkState === 'up-to-date') {
    statusText = `Du bist aktuell — Version ${version} ist die neueste.`;
    statusColor = '#7af2c5';
  } else if (checkState === 'error') {
    statusText = `Update-Prüfung fehlgeschlagen: ${errorMessage ?? 'unbekannter Fehler'}. Bei GitHub-Störungen später erneut versuchen.`;
    statusColor = '#ff7878';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#a0a0a8' }}>Installierte Version:</span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{version}</span>
      </div>

      <div>
        <button
          type="button"
          onClick={handleCheck}
          disabled={checkState === 'checking'}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid #4f46e5',
            background: checkState === 'checking' ? '#1c1c22' : '#22223a',
            color: '#a0bcff',
            cursor: checkState === 'checking' ? 'wait' : 'pointer',
          }}
        >
          {checkState === 'checking' ? 'Prüfe…' : 'Jetzt nach Updates suchen'}
        </button>
      </div>

      {statusText && <p style={{ margin: 0, fontSize: 12, color: statusColor }}>{statusText}</p>}

      <p style={{ margin: 0, fontSize: 11, color: '#6a6a72', lineHeight: 1.5 }}>
        Updates kommen von GitHub (2Brandsmedia/babaavatar). Die App prüft zusätzlich automatisch
        5 Sekunden nach jedem Start. Einstellungen, Avatare und Kalibrierungen bleiben bei jedem
        Update erhalten.
      </p>
    </div>
  );
});
