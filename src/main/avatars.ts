import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import Store from 'electron-store';
import type { AvatarRecord, VrmLicense } from '../shared/types.js';
import { readVrmLicense } from './vrm-license.js';
import { createLogger } from './logger.js';

const log = createLogger('avatars');

interface AvatarStoreSchema {
  avatars: AvatarRecord[];
}

const store = new Store<AvatarStoreSchema>({
  name: 'babaavatar-library',
  defaults: { avatars: [] },
});

function avatarsDir(): string {
  return path.join(app.getPath('userData'), 'avatars');
}

async function ensureAvatarsDir(): Promise<void> {
  await fs.mkdir(avatarsDir(), { recursive: true });
}

export function listAvatars(): AvatarRecord[] {
  return store.get('avatars', []);
}

export function getAvatar(id: string): AvatarRecord | null {
  const lookup = new Map(listAvatars().map((a) => [a.id, a]));
  return lookup.get(id) ?? null;
}

export interface ImportAvatarOptions {
  sourceUrl?: string;
  displayName?: string;
  thumbnailDataUrl?: string;
}

export async function importAvatarFromPath(
  filePath: string,
  options: ImportAvatarOptions = {},
): Promise<AvatarRecord> {
  await ensureAvatarsDir();
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) throw new Error('Pfad ist keine Datei');

  const buffer = await fs.readFile(filePath);
  return importAvatarFromBuffer(buffer, path.basename(filePath), options);
}

export async function importAvatarFromBuffer(
  buffer: Buffer,
  originalFileName: string,
  options: ImportAvatarOptions = {},
): Promise<AvatarRecord> {
  await ensureAvatarsDir();

  if (!isLikelyVrm(buffer)) {
    throw new Error('Datei ist kein gültiges VRM-Modell (Magic-Number-Check fehlgeschlagen)');
  }

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(originalFileName, id);
  const filePath = path.join(avatarsDir(), fileName);
  await fs.writeFile(filePath, buffer);

  let license: VrmLicense | null = null;
  try {
    license = await readVrmLicense(filePath);
  } catch (err) {
    log.warn('Lizenz-Parsing fehlgeschlagen', { err: String(err) });
  }

  const record: AvatarRecord = {
    id,
    fileName,
    filePath,
    thumbnailDataUrl: options.thumbnailDataUrl ?? null,
    license,
    addedAt: Date.now(),
    sourceUrl: options.sourceUrl ?? null,
    displayName: options.displayName ?? license?.title ?? path.parse(fileName).name,
  };

  const current = listAvatars();
  store.set('avatars', [...current, record]);
  log.info('Avatar importiert', { id, displayName: record.displayName });
  return record;
}

export async function updateAvatar(id: string, patch: Partial<AvatarRecord>): Promise<AvatarRecord> {
  const all = listAvatars();
  let updated: AvatarRecord | null = null;
  const next = all.map((avatar) => {
    if (avatar.id !== id) return avatar;
    updated = { ...avatar, ...patch };
    return updated;
  });
  if (!updated) throw new Error('Avatar nicht gefunden');
  store.set('avatars', next);
  return updated;
}

export async function deleteAvatar(id: string): Promise<void> {
  const all = listAvatars();
  const record = all.find((a) => a.id === id);
  if (!record) return;
  try {
    await fs.unlink(record.filePath);
  } catch (err) {
    log.warn('VRM-Datei konnte nicht gelöscht werden', { id, err: String(err) });
  }
  store.set(
    'avatars',
    all.filter((a) => a.id !== id),
  );
  log.info('Avatar gelöscht', { id });
}

export function openAvatarsFolder(): void {
  shell.openPath(avatarsDir());
}

function isLikelyVrm(buffer: Buffer): boolean {
  if (buffer.byteLength < 12) return false;
  return buffer.readUInt32LE(0) === 0x46546c67;
}

function sanitizeFileName(input: string, id: string): string {
  const base = input.replace(/[^a-zA-Z0-9_.-]/g, '_').toLowerCase();
  if (base.endsWith('.vrm')) return `${id}-${base}`;
  return `${id}-${base}.vrm`;
}
