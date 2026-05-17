import { memo, useRef, useState } from 'react';
import { api } from '@renderer/lib/ipc/api';
import { createReloadChannel } from '@renderer/lib/broadcast/reload-channel';

export const OutputTitleBar = memo(function OutputTitleBar(): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const [reloading, setReloading] = useState(false);
  const channelRef = useRef<ReturnType<typeof createReloadChannel> | null>(null);
  if (channelRef.current === null) channelRef.current = createReloadChannel();

  const handleReload = (): void => {
    setReloading(true);
    channelRef.current?.publish();
    window.setTimeout(() => setReloading(false), 1200);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        WebkitAppRegion: 'drag',
        background: hovered ? 'rgba(0, 0, 0, 0.55)' : 'transparent',
        transition: 'background 160ms ease',
        zIndex: 10,
        userSelect: 'none',
      } as React.CSSProperties}
    >
      <div
        style={{
          fontSize: 11,
          color: hovered ? '#e8e8ec' : 'rgba(255,255,255,0.5)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        BabaAvatar — Output (zum Verschieben hier ziehen)
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          aria-label="Avatar und Tracking neu laden"
          title="Avatar, Webcam und Audio-Lipsync neu starten"
          onClick={handleReload}
          disabled={reloading}
          style={
            {
              WebkitAppRegion: 'no-drag',
              background: hovered ? 'rgba(122,167,255,0.25)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              height: 22,
              padding: '0 8px',
              borderRadius: 4,
              cursor: reloading ? 'wait' : 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'background 120ms ease',
            } as React.CSSProperties
          }
        >
          <span
            style={{
              display: 'inline-block',
              transition: 'transform 600ms ease',
              transform: reloading ? 'rotate(720deg)' : 'rotate(0deg)',
            }}
          >
            ↻
          </span>
          {reloading ? 'Neu…' : 'Reload'}
        </button>
        <button
          type="button"
          aria-label="Output-Fenster schließen"
          onClick={() => void api.output.close()}
          style={
            {
              WebkitAppRegion: 'no-drag',
              background: hovered ? '#ff6b6b' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              width: 22,
              height: 22,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              transition: 'background 120ms ease',
            } as React.CSSProperties
          }
        >
          ×
        </button>
      </div>
    </div>
  );
});
