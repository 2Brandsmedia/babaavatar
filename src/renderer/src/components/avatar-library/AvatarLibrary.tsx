import { memo, useCallback, useEffect } from 'react';
import type { AvatarRecord } from '@shared/types';
import { useAvatarsStore } from '@renderer/store/avatars';
import { AvatarCard } from './AvatarCard';
import { DropZone } from './DropZone';
import { ImportButton } from './ImportButton';

interface AvatarLibraryProps {
  activeAvatarId: string | null;
  onSelect: (id: string) => void;
}

export const AvatarLibrary = memo(function AvatarLibrary({
  activeAvatarId,
  onSelect,
}: AvatarLibraryProps): JSX.Element {
  const { avatars, isLoading, error, load, importFile, remove, subscribeToAdditions } =
    useAvatarsStore();

  useEffect(() => {
    void load();
    const unsubscribe = subscribeToAdditions();
    return unsubscribe;
  }, [load, subscribeToAdditions]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const record = await importFile(file);
          onSelect(record.id);
        } catch (err) {
          console.error('Avatar-Import fehlgeschlagen', err);
        }
      }
    },
    [importFile, onSelect],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Avatar-Bibliothek</h2>
        <ImportButton onFile={(f) => void handleFiles([f])} />
      </div>

      <DropZone onFiles={(files) => void handleFiles(files)} />

      {isLoading && <p style={{ color: '#a0a0a8' }}>Lade Bibliothek…</p>}
      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

      {avatars.length === 0 ? (
        <p style={{ color: '#52525a', fontSize: 13 }}>
          Noch keine Avatare. Ziehe eine .vrm-Datei oder importiere sie.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          {avatars.map((avatar: AvatarRecord) => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              active={activeAvatarId === avatar.id}
              onSelect={onSelect}
              onDelete={(id) => void remove(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
