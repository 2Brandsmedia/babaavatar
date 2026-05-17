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

export const AvatarBrowser = memo(function AvatarBrowser(): JSX.Element {
  const [activeId, setActiveId] = useState<string>(DEFAULT_SOURCE?.id ?? 'vroid-hub');
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_SOURCE?.url ?? '');
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const browserAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.browser.navigate(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    const updateBounds = (): void => {
      const area = browserAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      void api.browser.show(bounds);
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    if (browserAreaRef.current) observer.observe(browserAreaRef.current);
    window.addEventListener('resize', updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
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
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 48px)' }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Avatar finden</h2>
      <SourceTabs activeId={activeId} onSelect={handleSelectSource} />
      <BrowserToolbar
        currentUrl={currentUrl}
        onNavigate={setCurrentUrl}
        onBack={() => void api.browser.back()}
        onForward={() => void api.browser.forward()}
        onReload={() => void api.browser.reload()}
      />
      <div
        ref={browserAreaRef}
        style={{
          flex: 1,
          minHeight: 320,
          background: '#1c1c22',
          border: '1px solid #2a2a32',
          borderRadius: 12,
        }}
      />
      <DownloadQueue downloads={Array.from(downloads.values())} />
      <VroidLoginButton onAuthenticated={() => void api.browser.reload()} />
      <CuratedList />
    </div>
  );
});
