import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import { createRequire } from 'node:module';
import type { AppUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc-channels.js';
import { createLogger } from './logger.js';

const require = createRequire(import.meta.url);
const electronUpdaterPkg: { autoUpdater: AppUpdater } = require('electron-updater');
const { autoUpdater } = electronUpdaterPkg;

const log = createLogger('auto-updater');

const SNOOZE_MS = 24 * 60 * 60 * 1000;

interface UpdaterStoreSchema {
  snoozedUntil: number;
  snoozedVersion: string;
}

const store = new Store<UpdaterStoreSchema>({
  name: 'babaavatar-updater',
  defaults: { snoozedUntil: 0, snoozedVersion: '' },
});

export type UpdaterDecision =
  | { type: 'download' }
  | { type: 'snooze' }
  | { type: 'skip' }
  | { type: 'install-now' }
  | { type: 'install-later' };

interface UpdaterOptions {
  controlWindow: BrowserWindow | null;
}

let currentWindow: BrowserWindow | null = null;
let downloadInProgress = false;
let pendingVersion: string | null = null;
let ipcRegistered = false;

export function initAutoUpdater({ controlWindow }: UpdaterOptions): void {
  currentWindow = controlWindow;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  if (!ipcRegistered) {
    registerIpc();
    ipcRegistered = true;
  }

  autoUpdater.on('checking-for-update', () => log.info('Suche nach Update'));

  autoUpdater.on('update-available', (info) => {
    log.info('Update verfuegbar', { version: info.version });
    pendingVersion = info.version;
    const snoozed = store.get('snoozedUntil');
    const snoozedFor = store.get('snoozedVersion');
    if (snoozedFor === info.version && Date.now() < snoozed) {
      log.info('Update vom User vertagt', { until: new Date(snoozed).toISOString() });
      return;
    }
    currentWindow?.webContents.send(IPC.UPDATER_AVAILABLE, {
      version: info.version,
      currentVersion: app.getVersion(),
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    });
  });

  autoUpdater.on('update-not-available', () => log.info('Keine neue Version'));

  autoUpdater.on('error', (err) => {
    log.error('Updater-Fehler', err);
    currentWindow?.webContents.send(IPC.UPDATER_ERROR, {
      message: err.message,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    currentWindow?.webContents.send(IPC.UPDATER_PROGRESS, {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update heruntergeladen', { version: info.version });
    downloadInProgress = false;
    currentWindow?.webContents.send(IPC.UPDATER_DOWNLOADED, { version: info.version });
  });

  // 5 s nach App-Start eine Pruefung
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update-Check fehlgeschlagen', err);
    });
  }, 5000);
}

function registerIpc(): void {
  ipcMain.handle(IPC.UPDATER_DECISION, (_e, decision: UpdaterDecision) => {
    handleDecision(decision);
  });
  ipcMain.handle(IPC.UPDATER_CHECK, () => {
    store.set('snoozedUntil', 0);
    store.set('snoozedVersion', '');
    return autoUpdater.checkForUpdates().catch((err) => {
      log.error('Manueller Update-Check fehlgeschlagen', err);
      return null;
    });
  });
}

function handleDecision(decision: UpdaterDecision): void {
  const version = pendingVersion ?? '?';
  switch (decision.type) {
    case 'download': {
      if (downloadInProgress) return;
      downloadInProgress = true;
      log.info('User: Download startet', { version });
      void autoUpdater.downloadUpdate().catch((err) => {
        log.error('Download fehlgeschlagen', err);
        downloadInProgress = false;
      });
      return;
    }
    case 'snooze': {
      store.set('snoozedUntil', Date.now() + SNOOZE_MS);
      store.set('snoozedVersion', version);
      log.info('User: Update vertagt um 24h', { version });
      return;
    }
    case 'skip': {
      store.set('snoozedUntil', Number.MAX_SAFE_INTEGER);
      store.set('snoozedVersion', version);
      log.info('User: Version uebersprungen', { version });
      return;
    }
    case 'install-now': {
      log.info('User: install-now');
      autoUpdater.quitAndInstall();
      return;
    }
    case 'install-later': {
      log.info('User: install-later (beim naechsten Quit)');
      return;
    }
  }
}

export function getPendingUpdateVersion(): string | null {
  return pendingVersion;
}
