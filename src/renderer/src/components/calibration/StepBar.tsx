import { memo } from 'react';
import { STEPS, type StepId, type StepSkipState } from './steps';

interface StepBarProps {
  activeIndex: number;
  completed: Set<StepId>;
  skipped: StepSkipState;
  onSelect: (index: number) => void;
}

export const StepBar = memo(function StepBar({
  activeIndex,
  completed,
  skipped,
  onSelect,
}: StepBarProps): JSX.Element {
  return (
    <ol
      style={{
        display: 'flex',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        gap: 4,
        flexWrap: 'wrap',
      }}
    >
      {STEPS.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isDone = completed.has(step.id);
        const isSkipped = skipped.skippedIds.has(step.id);
        const bg = isActive ? '#4f46e5' : isDone && !isSkipped ? '#1c3b22' : '#1c1c22';
        const color = isActive
          ? '#fff'
          : isSkipped
            ? '#4a4a55'
            : isDone
              ? '#7af2c5'
              : '#6a6a72';
        const border = isSkipped ? '#2a2a32' : isDone && !isActive ? '#1a4d36' : '#2a2a32';
        const prefix = isSkipped ? '↷ ' : isDone && !isActive ? '✓ ' : '';
        return (
          <li
            key={step.id}
            title={isSkipped ? skipped.reason.get(step.id) ?? 'Übersprungen' : step.title}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              background: bg,
              color,
              border: `1px solid ${border}`,
              cursor: 'pointer',
              opacity: isSkipped ? 0.65 : 1,
              textDecoration: isSkipped ? 'line-through' : 'none',
            }}
            onClick={() => onSelect(idx)}
          >
            {prefix}
            {step.title}
          </li>
        );
      })}
    </ol>
  );
});

interface SkipBannerProps {
  reason: string;
  onSkip: () => void;
}

export const SkipBanner = memo(function SkipBanner({ reason, onSkip }: SkipBannerProps): JSX.Element {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: '#1a2030',
        border: '1px solid #2a3a55',
        borderRadius: 8,
        fontSize: 13,
        color: '#7aa7ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>↷ {reason}</span>
      <button
        type="button"
        onClick={onSkip}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          background: '#22223a',
          color: '#cfd0d6',
          border: '1px solid #2a3a55',
          borderRadius: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Überspringen →
      </button>
    </div>
  );
});
