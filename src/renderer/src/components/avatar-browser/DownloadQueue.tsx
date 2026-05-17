import { memo } from 'react';
import type { DownloadProgress } from '@shared/types';

interface DownloadQueueProps {
  downloads: DownloadProgress[];
}

export const DownloadQueue = memo(function DownloadQueue({
  downloads,
}: DownloadQueueProps): JSX.Element | null {
  if (downloads.length === 0) return null;
  return (
    <div
      style={{
        background: '#15151a',
        border: '1px solid #2a2a32',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, color: '#a0a0a8' }}>Downloads</div>
      {downloads.map((d) => (
        <DownloadRow key={d.id} download={d} />
      ))}
    </div>
  );
});

interface DownloadRowProps {
  download: DownloadProgress;
}

const DownloadRow = memo(function DownloadRow({ download }: DownloadRowProps): JSX.Element {
  const percent =
    download.totalBytes > 0
      ? Math.round((download.receivedBytes / download.totalBytes) * 100)
      : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{download.filename}</span>
        <span style={{ color: '#7af2c5' }}>{download.state}</span>
      </div>
      <div style={{ background: '#26262e', borderRadius: 4, height: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${percent}%`,
            background: download.state === 'completed' ? '#4f46e5' : '#7af2c5',
            height: '100%',
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
});
