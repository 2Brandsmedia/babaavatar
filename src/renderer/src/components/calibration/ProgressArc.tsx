import { memo } from 'react';

interface ProgressArcProps {
  current: number;
  total: number;
  size?: number;
}

export const ProgressArc = memo(function ProgressArc({
  current,
  total,
  size = 72,
}: ProgressArcProps): JSX.Element {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, current / total));
  const dash = circumference * ratio;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1c1c22"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progress-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 320ms ease' }}
        />
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7aa7ff" />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e8e8ec',
          lineHeight: 1.1,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>{current}</div>
        <div style={{ fontSize: 10, color: '#6a6a72' }}>von {total}</div>
      </div>
    </div>
  );
});
