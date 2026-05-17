import { memo, useState } from 'react';
import { AvatarLibrary } from '@renderer/components/avatar-library/AvatarLibrary';
import { AvatarBrowser } from '@renderer/components/avatar-browser/AvatarBrowser';

type Tab = 'library' | 'browser';

interface AvatarsSectionProps {
  activeAvatarId: string | null;
  onSelect: (id: string) => void;
  avatarCount: number;
}

export const AvatarsSection = memo(function AvatarsSection({
  activeAvatarId,
  onSelect,
  avatarCount,
}: AvatarsSectionProps): JSX.Element {
  const [tab, setTab] = useState<Tab>(avatarCount === 0 ? 'browser' : 'library');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #2a2a32' }}>
        <TabButton id="library" active={tab === 'library'} onClick={setTab}>
          Meine Bibliothek ({avatarCount})
        </TabButton>
        <TabButton id="browser" active={tab === 'browser'} onClick={setTab}>
          Avatare finden
        </TabButton>
      </div>

      {tab === 'library' && (
        <AvatarLibrary activeAvatarId={activeAvatarId} onSelect={onSelect} />
      )}
      {tab === 'browser' && <AvatarBrowser />}
    </div>
  );
});

interface TabButtonProps {
  id: Tab;
  active: boolean;
  onClick: (id: Tab) => void;
  children: React.ReactNode;
}

const TabButton = memo(function TabButton({
  id,
  active,
  onClick,
  children,
}: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      style={{
        border: 'none',
        borderBottom: `2px solid ${active ? '#4f46e5' : 'transparent'}`,
        background: 'transparent',
        padding: '8px 14px',
        borderRadius: 0,
        color: active ? '#7aa7ff' : '#a0a0a8',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
});
