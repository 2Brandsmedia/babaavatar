import { memo } from 'react';
import { AVATAR_BROWSER_SOURCES } from '@shared/constants';

interface SourceTabsProps {
  activeId: string | null;
  onSelect: (id: string, url: string) => void;
}

export const SourceTabs = memo(function SourceTabs({
  activeId,
  onSelect,
}: SourceTabsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {AVATAR_BROWSER_SOURCES.map((source) => (
        <button
          key={source.id}
          type="button"
          onClick={() => onSelect(source.id, source.url)}
          title={source.description}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            background: activeId === source.id ? '#1c1c2a' : 'transparent',
            border: `1px solid ${activeId === source.id ? '#4f46e5' : '#2a2a32'}`,
            color: activeId === source.id ? '#7aa7ff' : '#e8e8ec',
          }}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
});
