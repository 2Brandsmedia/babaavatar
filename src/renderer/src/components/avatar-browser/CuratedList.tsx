import { memo, useState } from 'react';
import curatedData from '@shared/curated-avatars.json';
import type { CuratedAvatar } from '@shared/types';
import { useAvatarsStore } from '@renderer/store/avatars';
import { api } from '@renderer/lib/ipc/api';
import { renderVrmThumbnail } from '@renderer/lib/avatar/thumbnail';

const curated = curatedData.avatars as CuratedAvatar[];

export const CuratedList = memo(function CuratedList(): JSX.Element {
  const { load } = useAvatarsStore();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (entry: CuratedAvatar): Promise<void> => {
    setImportingId(entry.id);
    setError(null);
    try {
      const { buffer, fileName } = await api.curated.download({
        url: entry.downloadUrl,
        displayName: entry.displayName,
      });
      let thumbnailDataUrl: string | undefined;
      try {
        thumbnailDataUrl = await renderVrmThumbnail(buffer.slice(0));
      } catch (err) {
        console.warn('Thumbnail-Rendering fehlgeschlagen', err);
      }
      await api.avatars.importFile({
        buffer,
        fileName: fileName || `${entry.id}.vrm`,
        thumbnailDataUrl,
        sourceUrl: entry.downloadUrl,
        displayName: entry.displayName,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14 }}>Empfohlene Avatare (1-Klick-Import, kein Login nötig)</h3>
        <p style={{ margin: '4px 0 0 0', color: '#a0a0a8', fontSize: 12 }}>
          Diese Avatare sind frei verfügbar und werden direkt von GitHub geladen. Für VRoid Hub, Booth und Co. brauchst du leider ein Konto bei der jeweiligen Plattform.
        </p>
      </div>
      {error && <p style={{ color: '#ff7878', fontSize: 12, margin: 0 }}>Fehler: {error}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {curated.map((entry) => (
          <CuratedCard
            key={entry.id}
            entry={entry}
            importing={importingId === entry.id}
            onImport={() => void handleImport(entry)}
          />
        ))}
      </div>
    </div>
  );
});

interface CuratedCardProps {
  entry: CuratedAvatar;
  importing: boolean;
  onImport: () => void;
}

const CuratedCard = memo(function CuratedCard({
  entry,
  importing,
  onImport,
}: CuratedCardProps): JSX.Element {
  return (
    <article
      style={{
        background: '#1c1c22',
        border: '1px solid #2a2a32',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.displayName}</div>
      <div style={{ color: '#a0a0a8', fontSize: 12, minHeight: 32 }}>{entry.description}</div>
      <div style={{ color: '#7af2c5', fontSize: 11 }}>
        {entry.author} · {entry.license}
      </div>
      <button
        type="button"
        className="primary"
        onClick={onImport}
        disabled={importing}
        aria-label={`${entry.displayName} importieren`}
      >
        {importing ? 'Lade…' : 'Importieren'}
      </button>
    </article>
  );
});
