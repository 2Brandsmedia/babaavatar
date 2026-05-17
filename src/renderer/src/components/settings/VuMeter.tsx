import { memo, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';

interface VuMeterProps {
  threshold: number;
}

export const VuMeter = memo(function VuMeter({ threshold }: VuMeterProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const ledRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const { micLevel, micGateOpen } = useTrackingStore.getState();
      const pct = Math.min(100, Math.max(0, micLevel * 100));
      if (barRef.current) {
        barRef.current.style.width = `${pct}%`;
        barRef.current.style.background = micGateOpen
          ? 'linear-gradient(90deg, #4ade80 0%, #facc15 70%, #ef4444 100%)'
          : 'linear-gradient(90deg, #3a3a44 0%, #4a4a55 100%)';
      }
      if (ledRef.current) {
        ledRef.current.style.background = micGateOpen ? '#4ade80' : '#3a3a44';
        ledRef.current.style.boxShadow = micGateOpen ? '0 0 8px rgba(74,222,128,0.7)' : 'none';
      }
      if (valueRef.current) {
        valueRef.current.textContent = micLevel.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const markerLeft = `${Math.min(100, Math.max(0, threshold * 100))}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          ref={ledRef}
          aria-label="Voice-Activity-LED"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#3a3a44',
            transition: 'background 80ms linear, box-shadow 80ms linear',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            position: 'relative',
            flex: 1,
            height: 14,
            background: '#1a1a22',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid #2a2a32',
          }}
        >
          <div
            ref={barRef}
            style={{ width: '0%', height: '100%', background: '#3a3a44', transition: 'width 60ms linear' }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -2,
              bottom: -2,
              left: markerLeft,
              width: 2,
              background: '#7aa7ff',
              boxShadow: '0 0 4px rgba(122,167,255,0.7)',
            }}
          />
        </div>
        <span
          ref={valueRef}
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: '#7aa7ff',
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          0.000
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6a6a72' }}>
        <span>Stille</span>
        <span>Schwelle (blau)</span>
        <span>Laut</span>
      </div>
    </div>
  );
});
