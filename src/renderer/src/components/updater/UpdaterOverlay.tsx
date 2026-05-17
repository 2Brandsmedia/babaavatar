import { memo, useEffect } from 'react';
import { api } from '@renderer/lib/ipc/api';
import { useUpdaterStore, type UpdaterProgress } from '@renderer/store/updater';

export const UpdaterOverlay = memo(function UpdaterOverlay(): JSX.Element | null {
  const phase = useUpdaterStore((s) => s.phase);
  const version = useUpdaterStore((s) => s.version);
  const currentVersion = useUpdaterStore((s) => s.currentVersion);
  const releaseNotes = useUpdaterStore((s) => s.releaseNotes);
  const progress = useUpdaterStore((s) => s.progress);
  const errorMessage = useUpdaterStore((s) => s.errorMessage);
  const dismiss = useUpdaterStore((s) => s.dismiss);
  const setDownloading = useUpdaterStore((s) => s.setDownloading);

  useEffect(() => {
    const offAvailable = api.on<{
      version: string;
      currentVersion: string;
      releaseNotes: string | null;
    }>(api.ipcChannels.UPDATER_AVAILABLE, (payload) => {
      useUpdaterStore.getState().setAvailable(payload);
    });
    const offProgress = api.on<UpdaterProgress>(api.ipcChannels.UPDATER_PROGRESS, (p) => {
      useUpdaterStore.getState().setProgress(p);
    });
    const offDownloaded = api.on<{ version: string }>(
      api.ipcChannels.UPDATER_DOWNLOADED,
      (p) => {
        useUpdaterStore.getState().setDownloaded(p.version);
      },
    );
    const offError = api.on<{ message: string }>(api.ipcChannels.UPDATER_ERROR, (p) => {
      useUpdaterStore.getState().setError(p.message);
    });
    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 8, 12, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          background: 'linear-gradient(180deg, #1a1a22 0%, #15151a 100%)',
          border: '1px solid #2a2a32',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(122,167,255,0.08)',
          color: '#e8e8ec',
        }}
      >
        <Header phase={phase} version={version} currentVersion={currentVersion} />
        <Body
          phase={phase}
          version={version}
          releaseNotes={releaseNotes}
          progress={progress}
          errorMessage={errorMessage}
        />
        <Actions phase={phase} onClose={dismiss} onDownload={setDownloading} />
      </div>
    </div>
  );
});

interface HeaderProps {
  phase: string;
  version: string | null;
  currentVersion: string | null;
}

const Header = memo(function Header({ phase, version, currentVersion }: HeaderProps): JSX.Element {
  const title =
    phase === 'available'
      ? 'Update verfügbar'
      : phase === 'downloading'
        ? 'Update wird heruntergeladen'
        : phase === 'downloaded'
          ? 'Update bereit zur Installation'
          : 'Update-Fehler';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #4f46e5 0%, #7aa7ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        ⬆
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        {version && (
          <div style={{ fontSize: 12, color: '#a0a0a8' }}>
            {currentVersion ? `${currentVersion} → ${version}` : `Version ${version}`}
          </div>
        )}
      </div>
    </div>
  );
});

interface BodyProps {
  phase: string;
  version: string | null;
  releaseNotes: string | null;
  progress: UpdaterProgress | null;
  errorMessage: string | null;
}

const Body = memo(function Body({
  phase,
  version,
  releaseNotes,
  progress,
  errorMessage,
}: BodyProps): JSX.Element {
  if (phase === 'error') {
    return (
      <p style={{ margin: '0 0 18px 0', fontSize: 13, color: '#ff7878', lineHeight: 1.6 }}>
        {errorMessage ?? 'Unbekannter Fehler beim Update.'}
      </p>
    );
  }
  if (phase === 'downloading') {
    const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
    const mbDone = progress ? (progress.transferred / (1024 * 1024)).toFixed(1) : '0.0';
    const mbTotal = progress ? (progress.total / (1024 * 1024)).toFixed(1) : '?';
    return (
      <div style={{ margin: '4px 0 18px 0' }}>
        <div
          style={{
            height: 8,
            background: '#0f0f12',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid #2a2a32',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4f46e5 0%, #7aa7ff 100%)',
              transition: 'width 200ms ease',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#a0a0a8',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {mbDone} / {mbTotal} MB
          </span>
          <span>{pct.toFixed(0)} %</span>
        </div>
      </div>
    );
  }
  if (phase === 'downloaded') {
    return (
      <p style={{ margin: '0 0 18px 0', fontSize: 13, color: '#cfd0d6', lineHeight: 1.6 }}>
        BabaAvatar {version} ist heruntergeladen und bereit. Beim Neustart wird das Update
        installiert. Deine Settings, Profile und Avatar-Bibliothek bleiben erhalten.
      </p>
    );
  }
  return (
    <div style={{ margin: '0 0 18px 0' }}>
      <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#cfd0d6', lineHeight: 1.6 }}>
        Eine neue Version steht bereit. Du kannst sie jetzt herunterladen oder später erinnert
        werden.
      </p>
      {releaseNotes && (
        <details style={{ fontSize: 12, color: '#a0a0a8' }}>
          <summary style={{ cursor: 'pointer', color: '#7aa7ff' }}>Was ist neu?</summary>
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: '#0f0f12',
              border: '1px solid #2a2a32',
              borderRadius: 6,
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {releaseNotes}
          </div>
        </details>
      )}
    </div>
  );
});

interface ActionsProps {
  phase: string;
  onClose: () => void;
  onDownload: () => void;
}

const Actions = memo(function Actions({ phase, onClose, onDownload }: ActionsProps): JSX.Element {
  if (phase === 'available') {
    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          label="Überspringen"
          variant="ghost"
          onClick={() => {
            void api.updater.decide({ type: 'skip' });
            onClose();
          }}
        />
        <Button
          label="Später (24h)"
          variant="ghost"
          onClick={() => {
            void api.updater.decide({ type: 'snooze' });
            onClose();
          }}
        />
        <Button
          label="Jetzt herunterladen"
          variant="primary"
          onClick={() => {
            onDownload();
            void api.updater.decide({ type: 'download' });
          }}
        />
      </div>
    );
  }
  if (phase === 'downloading') {
    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          label="Im Hintergrund laufen lassen"
          variant="ghost"
          onClick={onClose}
        />
      </div>
    );
  }
  if (phase === 'downloaded') {
    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          label="Beim nächsten Beenden"
          variant="ghost"
          onClick={() => {
            void api.updater.decide({ type: 'install-later' });
            onClose();
          }}
        />
        <Button
          label="Jetzt neu starten"
          variant="primary"
          onClick={() => {
            void api.updater.decide({ type: 'install-now' });
          }}
        />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button label="Schliessen" variant="primary" onClick={onClose} />
    </div>
  );
});

interface ButtonProps {
  label: string;
  variant: 'primary' | 'ghost';
  onClick: () => void;
}

const Button = memo(function Button({ label, variant, onClick }: ButtonProps): JSX.Element {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: isPrimary ? 600 : 400,
        background: isPrimary ? 'linear-gradient(135deg, #4f46e5 0%, #7aa7ff 100%)' : 'transparent',
        color: isPrimary ? '#fff' : '#a0a0a8',
        border: isPrimary ? 'none' : '1px solid #2a2a32',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'transform 80ms ease',
      }}
    >
      {label}
    </button>
  );
});
