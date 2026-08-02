import fs from 'node:fs/promises';
import path from 'node:path';
import { app, shell } from 'electron';
import { createLogger } from './logger.js';

const log = createLogger('recordings');

function recordingsDir(): string {
  return path.join(app.getPath('userData'), 'recordings');
}

export async function saveRecording(payload: {
  buffer: ArrayBuffer;
  mimeType: string;
}): Promise<{ filePath: string; bytes: number }> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });

  const extension = payload.mimeType.includes('json')
    ? 'json'
    : payload.mimeType.includes('mp4')
      ? 'mp4'
      : 'webm';
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const filePath = path.join(dir, `babaavatar_${stamp}.${extension}`);

  const data = Buffer.from(payload.buffer);
  await fs.writeFile(filePath, data);
  log.info('Aufnahme gespeichert', { filePath, bytes: data.length });
  return { filePath, bytes: data.length };
}

export async function openRecordingsFolder(): Promise<void> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
}
