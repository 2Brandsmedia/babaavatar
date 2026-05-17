import { memo, useEffect, useRef } from 'react';
import type { VmcSnapshot } from '@shared/types';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';

interface TrackerDebugPanelProps {
  enabled: boolean;
}

export const TrackerDebugPanel = memo(function TrackerDebugPanel({
  enabled,
}: TrackerDebugPanelProps): JSX.Element | null {
  const containerRef = useRef<HTMLPreElement>(null);
  const lastFrameRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((snapshot) => {
      lastFrameRef.current = snapshot;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = (): void => {
      const last = lastFrameRef.current;
      if (containerRef.current && last) {
        const entries = Object.entries(last.blendShapes);
        const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 12);
        const head = last.headEuler
          ? `Head Euler (rad): x=${last.headEuler.x.toFixed(2)} y=${last.headEuler.y.toFixed(2)} z=${last.headEuler.z.toFixed(2)}`
          : last.headQuat
            ? `Head Quat: x=${last.headQuat.x.toFixed(2)} y=${last.headQuat.y.toFixed(2)} z=${last.headQuat.z.toFixed(2)} w=${last.headQuat.w.toFixed(2)}`
            : 'Head: keine Daten';
        const ageMs = Date.now() - last.receivedAt;
        const meta = `Letztes Paket vor ${ageMs} ms · ${entries.length} BlendShapes gesamt`;
        const rows = sorted.map(([name, value]) => {
          const pct = Math.max(0, Math.min(1, Math.abs(value)));
          return `${name.padEnd(22)} ${value.toFixed(3)} ${'█'.repeat(Math.round(pct * 20))}`;
        });
        containerRef.current.textContent = [meta, head, '', ...rows].join('\n');
      } else if (containerRef.current) {
        containerRef.current.textContent = 'Keine Daten empfangen.';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontSize: 12, color: '#cfd0d6' }}>
        Debug: Rohdaten anzeigen
      </summary>
      <pre
        ref={containerRef}
        style={{
          marginTop: 8,
          padding: 12,
          background: '#0f0f12',
          border: '1px solid #2a2a32',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
          color: '#7af2c5',
          lineHeight: 1.5,
          maxHeight: 320,
          overflow: 'auto',
          whiteSpace: 'pre',
        }}
      >
        Keine Daten empfangen.
      </pre>
    </details>
  );
});
