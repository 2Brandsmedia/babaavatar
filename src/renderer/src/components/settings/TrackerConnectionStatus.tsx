import { memo, useEffect, useRef } from 'react';
import type { VmcSnapshot } from '@shared/types';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';

interface TrackerConnectionStatusProps {
  enabled: boolean;
}

export const TrackerConnectionStatus = memo(function TrackerConnectionStatus({
  enabled,
}: TrackerConnectionStatusProps): JSX.Element {
  const ledRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const lastFrameRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((snapshot) => {
      lastFrameRef.current = snapshot;
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const last = lastFrameRef.current;
      const active = enabled && last !== null && Date.now() - last.receivedAt < 2000;
      if (ledRef.current) {
        ledRef.current.style.background = active ? '#4ade80' : enabled ? '#facc15' : '#3a3a44';
        ledRef.current.style.boxShadow = active ? '0 0 8px rgba(74,222,128,0.7)' : 'none';
      }
      if (textRef.current) {
        if (!enabled) textRef.current.textContent = 'Empfänger aus';
        else if (active) {
          const keys = Object.keys(last?.blendShapes ?? {}).length;
          textRef.current.textContent = `verbunden (${keys} BlendShapes)`;
        } else {
          textRef.current.textContent = 'wartet auf Daten…';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        ref={ledRef}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#3a3a44',
          transition: 'background 80ms linear, box-shadow 80ms linear',
        }}
      />
      <span ref={textRef} style={{ fontSize: 13, color: '#cfd0d6' }}>
        Empfänger aus
      </span>
    </div>
  );
});
