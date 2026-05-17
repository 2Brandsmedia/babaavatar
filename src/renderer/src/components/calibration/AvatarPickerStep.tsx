import { memo, useEffect } from 'react';
import { useAvatarsStore } from '@renderer/store/avatars';
import { useSettingsStore } from '@renderer/store/settings';

interface AvatarPickerStepProps {
  onPicked: () => void;
}

export const AvatarPickerStep = memo(function AvatarPickerStep({ onPicked }: AvatarPickerStepProps): JSX.Element {
  const avatars = useAvatarsStore((s) => s.avatars);
  const loadAvatars = useAvatarsStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  useEffect(() => {
    if (avatars.length === 0) void loadAvatars();
  }, [avatars.length, loadAvatars]);

  useEffect(() => {
    if (settings?.activeAvatarId) onPicked();
  }, [settings?.activeAvatarId, onPicked]);

  const selectedId = settings?.activeAvatarId ?? null;

  const handlePick = (id: string): void => {
    void update('activeAvatarId', id);
    onPicked();
  };

  if (avatars.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          Du hast noch keine Avatare. Wechsle links in der Sidebar zu „Avatare" → „Avatare finden",
          lade einen herunter (z.B. den empfohlenen Perfect-Sync-Avatar) und komm dann zurück.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        Wähle den Avatar für diese Session. Klick aktiviert ihn direkt im Output-Fenster.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          maxHeight: 480,
          overflowY: 'auto',
        }}
      >
        {avatars.map((avatar) => {
          const active = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => handlePick(avatar.id)}
              style={{
                padding: 8,
                background: active ? '#1c2a3a' : '#1c1c22',
                border: `2px solid ${active ? '#4f46e5' : '#2a2a32'}`,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: '#0f0f12',
                  borderRadius: 6,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {avatar.thumbnailDataUrl ? (
                  <img
                    src={avatar.thumbnailDataUrl}
                    alt={avatar.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: '#6a6a72', fontSize: 11 }}>kein Bild</span>
                )}
              </div>
              <span style={{ fontSize: 12, color: active ? '#7aa7ff' : '#e0e0e8' }}>
                {avatar.displayName}
              </span>
              {active && <span style={{ fontSize: 11, color: '#7af2c5' }}>✓ aktiv</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
});
