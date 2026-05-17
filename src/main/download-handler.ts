import { session, app, type Event, type DownloadItem, type WebContents } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { IPC } from '../shared/ipc-channels.js';
import type { DownloadProgress } from '../shared/types.js';
import { importAvatarFromPath } from './avatars.js';
import { createLogger } from './logger.js';

const log = createLogger('download-handler');

interface BroadcastFn {
  (channel: string, payload: unknown): void;
}

let broadcast: BroadcastFn = () => undefined;

export function setDownloadBroadcast(fn: BroadcastFn): void {
  broadcast = fn;
}

export function registerDownloadHandler(): void {
  session.defaultSession.on('will-download', handleDownload);
  log.info('Download-Handler registriert');
}

function handleDownload(_event: Event, item: DownloadItem, _webContents: WebContents): void {
  const filename = item.getFilename();
  if (!filename.toLowerCase().endsWith('.vrm')) return;

  const url = item.getURL();
  const tempDir = path.join(app.getPath('userData'), 'downloads');
  void fs.mkdir(tempDir, { recursive: true });

  const tempPath = path.join(tempDir, filename);
  item.setSavePath(tempPath);

  log.info('VRM-Download gestartet', { filename, url });

  const id = `${Date.now()}-${filename}`;

  item.on('updated', (_e, state) => {
    const progress: DownloadProgress = {
      id,
      filename,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: state === 'progressing' ? 'progressing' : 'interrupted',
    };
    broadcast(IPC.DOWNLOAD_PROGRESS, progress);
  });

  item.once('done', async (_e, state) => {
    const totalBytes = item.getTotalBytes();
    const receivedBytes = item.getReceivedBytes();
    const done: DownloadProgress = {
      id,
      filename,
      receivedBytes,
      totalBytes,
      state: state === 'completed' ? 'completed' : (state as DownloadProgress['state']),
    };
    broadcast(IPC.DOWNLOAD_PROGRESS, done);

    if (state !== 'completed') {
      log.warn('VRM-Download nicht abgeschlossen', { filename, state });
      return;
    }
    try {
      const record = await importAvatarFromPath(tempPath, { sourceUrl: url });
      broadcast(IPC.DOWNLOAD_DONE, { id, filename, avatar: record });
      await fs.unlink(tempPath).catch(() => undefined);
      log.info('VRM importiert', { id: record.id });
    } catch (err) {
      log.error('Import nach Download fehlgeschlagen', err, { filename });
    }
  });
}
