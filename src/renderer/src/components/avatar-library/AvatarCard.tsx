import { memo } from 'react';
import type { AvatarRecord } from '@shared/types';
import { LicenseBadge } from './LicenseBadge';

interface AvatarCardProps {
  avatar: AvatarRecord;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AvatarCard = memo(function AvatarCard({
  avatar,
  active,
  onSelect,
  onDelete,
}: AvatarCardProps): JSX.Element {
  return (
    <div
      onClick={() => onSelect(avatar.id)}
      style={{
        background: '#1c1c22',
        border: `1px solid ${active ? '#4f46e5' : '#2a2a32'}`,
        borderRadius: 12,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#0f0f12',
          borderRadius: 8,
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
          <span style={{ color: '#52525a', fontSize: 12 }}>Keine Vorschau</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {avatar.displayName}
        </div>
        <LicenseBadge license={avatar.license} />
      </div>
      <button
        type="button"
        aria-label="Avatar löschen"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(avatar.id);
        }}
        style={{
          fontSize: 11,
          padding: '4px 8px',
          background: 'transparent',
          border: '1px solid #3b1b1b',
          color: '#ff7878',
        }}
      >
        Löschen
      </button>
    </div>
  );
});
