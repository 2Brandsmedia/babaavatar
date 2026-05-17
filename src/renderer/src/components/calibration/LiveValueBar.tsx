import { memo } from 'react';

interface LiveValueBarProps {
  label: string;
  value: number;
  reference?: number | null;
  min?: number;
  max?: number;
}

export const LiveValueBar = memo(function LiveValueBar({
  label,
  value,
  reference,
  min = 0,
  max = 1,
}: LiveValueBarProps): JSX.Element {
  const clamped = clamp(value, min, max);
  const pct = ((clamped - min) / (max - min)) * 100;
  const refPct =
    reference !== null && reference !== undefined
      ? ((clamp(reference, min, max) - min) / (max - min)) * 100
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#a0a0a8',
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: '#7af2c5' }}>
          {value.toFixed(3)}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 8,
          background: '#26262e',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #4f46e5, #7af2c5)',
            height: '100%',
            transition: 'width 80ms linear',
          }}
        />
        {refPct !== null && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: `${refPct}%`,
              width: 2,
              height: 12,
              background: '#ffcf6e',
            }}
            aria-label={`Gespeicherter Wert: ${reference}`}
          />
        )}
      </div>
    </div>
  );
});

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
