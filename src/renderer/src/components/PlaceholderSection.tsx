import { memo } from 'react';

interface PlaceholderSectionProps {
  title: string;
  description: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const PlaceholderSection = memo(function PlaceholderSection({
  title,
  description,
  onAction,
  actionLabel,
}: PlaceholderSectionProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
      <p style={{ color: '#a0a0a8', margin: 0 }}>{description}</p>
      {onAction && actionLabel && (
        <div>
          <button type="button" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
});
