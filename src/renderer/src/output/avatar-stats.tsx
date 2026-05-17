import { memo, useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import type { SceneContext } from '@renderer/lib/three/scene';

export interface RenderStats {
  fps: number;
  triangles: number;
  calls: number;
  heapMb: number;
}

export function useRendererStats(
  sceneRef: RefObject<SceneContext | null>,
  frameCounterRef: MutableRefObject<number>,
): RenderStats {
  const [stats, setStats] = useState<RenderStats>({ fps: 0, triangles: 0, calls: 0, heapMb: 0 });

  useEffect(() => {
    let lastSample = performance.now();
    const handle = window.setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - lastSample) / 1000;
      const fps = elapsedSec > 0 ? frameCounterRef.current / elapsedSec : 0;
      frameCounterRef.current = 0;
      lastSample = now;
      const info = sceneRef.current?.renderer.info.render;
      type PerfMemory = { usedJSHeapSize: number };
      const memory = (performance as Performance & { memory?: PerfMemory }).memory;
      const heapMb = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
      setStats({
        fps: Math.round(fps),
        triangles: info?.triangles ?? 0,
        calls: info?.calls ?? 0,
        heapMb: Math.round(heapMb),
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [sceneRef, frameCounterRef]);

  return stats;
}

interface StatsOverlayProps {
  stats: RenderStats;
}

export const StatsOverlay = memo(function StatsOverlay({ stats }: StatsOverlayProps): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(0,0,0,0.6)',
        color: '#7af2c5',
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        lineHeight: 1.5,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div>FPS: {stats.fps}</div>
      <div>Triangles: {stats.triangles.toLocaleString()}</div>
      <div>Draw Calls: {stats.calls}</div>
      <div>JS Heap: {stats.heapMb} MB</div>
    </div>
  );
});
