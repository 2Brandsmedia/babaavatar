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
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {STEPS.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isDone = completed.has(step.id);
        const isSkipped = skipped.skippedIds.has(step.id);
        const label = isSkipped
          ? skipped.reason.get(step.id) ?? 'Übersprungen'
          : step.title;

        const styles = chipStyles(isActive, isDone, isSkipped);

        return (
          <li
            key={step.id}
            title={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 11,
              cursor: 'pointer',
              opacity: isSkipped ? 0.55 : 1,
              transition: 'background 160ms ease, color 160ms ease, transform 160ms ease',
              transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
              ...styles,
            }}
            onClick={() => onSelect(idx)}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>
              {isSkipped ? '↷' : isDone && !isActive ? '✓' : step.icon}
            </span>
            <span style={{ textDecoration: isSkipped ? 'line-through' : 'none' }}>
              {step.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
});

function chipStyles(
  isActive: boolean,
  isDone: boolean,
  isSkipped: boolean,
): { background: string; color: string; border: string } {
  if (isActive) {
    return {
      background: 'linear-gradient(135deg, #4f46e5 0%, #7aa7ff 100%)',
      color: '#fff',
      border: '1px solid #4f46e5',
    };
  }
  if (isSkipped) {
    return { background: '#15151a', color: '#52525a', border: '1px solid #2a2a32' };
  }
  if (isDone) {
    return { background: '#1c3b22', color: '#7af2c5', border: '1px solid #1a4d36' };
  }
  return { background: '#1c1c22', color: '#a0a0a8', border: '1px solid #2a2a32' };
}

interface SkipBannerProps {
  reason: string;
  onSkip: () => void;
}

export const SkipBanner = memo(function SkipBanner({ reason, onSkip }: SkipBannerProps): JSX.Element {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(79,70,229,0.16) 0%, rgba(122,167,255,0.08) 100%)',
        border: '1px solid #2a3a55',
        borderRadius: 10,
        fontSize: 13,
        color: '#cfd0d6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>↷</span>
        {reason}
      </span>
      <button
        type="button"
        onClick={onSkip}
        style={{
          padding: '6px 14px',
          fontSize: 12,
          background: 'rgba(79,70,229,0.25)',
          color: '#cfd0d6',
          border: '1px solid #2a3a55',
          borderRadius: 8,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        Überspringen →
      </button>
    </div>
  );
});
