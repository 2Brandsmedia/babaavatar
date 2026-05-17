import { memo, useEffect, useRef, useState } from 'react';
import { AVATAR_BROWSER_SOURCES } from '@shared/constants';
import type { DownloadProgress } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { SourceTabs } from './SourceTabs';
import { BrowserToolbar } from './BrowserToolbar';
import { DownloadQueue } from './DownloadQueue';
import { CuratedList } from './CuratedList';
import { VroidLoginButton } from './vroid-oauth/VroidLoginButton';

const DEFAULT_SOURCE = AVATAR_BROWSER_SOURCES[0];
const BROWSER_AREA_HEIGHT = 520;

export const AvatarBrowser = memo(function AvatarBrowser(): JSX.Element {
  const [activeId, setActiveId] = useState<string>(DEFAULT_SOURCE?.id ?? 'vroid-hub');
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_SOURCE?.url ?? '');
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const browserAreaRef = useRef<HTMLDivElement>(null);
  const updateBoundsRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    void api.browser.navigate(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    const updateBounds = (): void => {
      const area = browserAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        void api.browser.hide();
        return;
      }
      void api.browser.show({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    updateBoundsRef.current = updateBounds;
    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    if (browserAreaRef.current) observer.observe(browserAreaRef.current);
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    const interval = window.setInterval(updateBounds, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
      window.clearInterval(interval);
      void api.browser.hide();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = api.on<DownloadProgress>(api.ipcChannels.DOWNLOAD_PROGRESS, (progress) => {
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(progress.id, progress);
        return next;
      });
    });
    return unsubscribe;
  }, []);

  const handleSelectSource = (id: string, url: string): void => {
    setActiveId(id);
    setCurrentUrl(url);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: 'calc(100vh - 88px)',
        overflow: 'hidden',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, flexShrink: 0 }}>Avatar finden</h2>
      <div style={{ flexShrink: 0 }}>
        <SourceTabs activeId={activeId} onSelect={handleSelectSource} />
      </div>
      <div style={{ flexShrink: 0 }}>
        <BrowserToolbar
          currentUrl={currentUrl}
          onNavigate={setCurrentUrl}
          onBack={() => void api.browser.back()}
          onForward={() => void api.browser.forward()}
          onReload={() => void api.browser.reload()}
        />
      </div>
      <div
        ref={browserAreaRef}
        style={{
          height: BROWSER_AREA_HEIGHT,
          flexShrink: 0,
          background: '#1c1c22',
          border: '1px solid #2a2a32',
          borderRadius: 12,
        }}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingRight: 4,
        }}
      >
        <DownloadQueue downloads={Array.from(downloads.values())} />
        <VroidLoginButton onAuthenticated={() => void api.browser.reload()} />
        <CuratedList />
      </div>
    </div>
  );
});
