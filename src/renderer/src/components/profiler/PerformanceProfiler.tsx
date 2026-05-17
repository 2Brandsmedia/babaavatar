import { memo, useEffect, useState } from 'react';

interface ProfilerMetrics {
  rendererFps: number;
  jsHeapMb: number;
  memoryLimitMb: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export const PerformanceProfiler = memo(function PerformanceProfiler(): JSX.Element {
  const [metrics, setMetrics] = useState<ProfilerMetrics>({
    rendererFps: 0,
    jsHeapMb: 0,
    memoryLimitMb: 0,
  });

  useEffect(() => {
    let frames = 0;
    let frameHandle = 0;
    let lastSample = performance.now();

    const tick = (): void => {
      frameHandle = requestAnimationFrame(tick);
      frames += 1;
      const now = performance.now();
      if (now - lastSample >= 1000) {
        const memory = (performance as PerformanceWithMemory).memory;
        setMetrics({
          rendererFps: frames,
          jsHeapMb: memory ? memory.usedJSHeapSize / (1024 * 1024) : 0,
          memoryLimitMb: memory ? memory.jsHeapSizeLimit / (1024 * 1024) : 0,
        });
        frames = 0;
        lastSample = now;
      }
    };
    tick();
    return () => cancelAnimationFrame(frameHandle);
  }, []);

  return (
    <div
      style={{
        background: '#15151a',
        border: '1px solid #2a2a32',
        borderRadius: 12,
        padding: 12,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        color: '#7af2c5',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ color: '#a0a0a8', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
        PERFORMANCE
      </div>
      <div>Renderer-FPS: {metrics.rendererFps}</div>
      <div>JS-Heap: {metrics.jsHeapMb.toFixed(1)} MB / {metrics.memoryLimitMb.toFixed(0)} MB</div>
    </div>
  );
});
