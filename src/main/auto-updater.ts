import { app, BrowserWindow, dialog } from 'electron';
import Store from 'electron-store';
import { createRequire } from 'node:module';
import type { AppUpdater } from 'electron-updater';
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

interface UpdaterOptions {
  controlWindow: BrowserWindow | null;
}

let currentWindow: BrowserWindow | null = null;
let downloadInProgress = false;
let pendingVersion: string | null = null;

export function initAutoUpdater({ controlWindow }: UpdaterOptions): void {
  currentWindow = controlWindow;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

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
    void askUserToDownload(info.version);
  });

  autoUpdater.on('update-not-available', () => log.info('Keine neue Version'));

  autoUpdater.on('error', (err) => log.error('Updater-Fehler', err));

  autoUpdater.on('download-progress', (progress) => {
    currentWindow?.webContents.send('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update heruntergeladen', { version: info.version });
    downloadInProgress = false;
    currentWindow?.webContents.send('updater:downloaded', { version: info.version });
    void askUserToInstall(info.version);
  });

  // Beim Start nur PRUEFEN, nicht herunterladen
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update-Check fehlgeschlagen', err);
    });
  }, 5000);
}

async function askUserToDownload(version: string): Promise<void> {
  if (downloadInProgress) return;
  const target = currentWindow ?? undefined;
  const result = await dialog.showMessageBox(target as BrowserWindow, {
    type: 'question',
    buttons: ['Jetzt herunterladen', 'Spaeter (24h)', 'Ueberspringen'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update verfuegbar',
    message: `BabaAvatar ${version} ist verfuegbar.`,
    detail: `Aktuelle Version: ${app.getVersion()}\nMoechtest du das Update jetzt herunterladen?`,
  });
  if (result.response === 0) {
    downloadInProgress = true;
    log.info('User: Download startet', { version });
    void autoUpdater.downloadUpdate().catch((err) => {
      log.error('Download fehlgeschlagen', err);
      downloadInProgress = false;
    });
  } else if (result.response === 1) {
    store.set('snoozedUntil', Date.now() + SNOOZE_MS);
    store.set('snoozedVersion', version);
    log.info('User: Update vertagt um 24h', { version });
  } else {
    store.set('snoozedUntil', Number.MAX_SAFE_INTEGER);
    store.set('snoozedVersion', version);
    log.info('User: Version uebersprungen', { version });
  }
}

async function askUserToInstall(version: string): Promise<void> {
  const target = currentWindow ?? undefined;
  const result = await dialog.showMessageBox(target as BrowserWindow, {
    type: 'info',
    buttons: ['Jetzt neu starten und installieren', 'Beim naechsten Beenden installieren'],
    defaultId: 0,
    title: 'Update bereit zur Installation',
    message: `BabaAvatar ${version} wurde heruntergeladen.`,
    detail: 'Beim Neustart wird das Update installiert. Settings und Avatar-Bibliothek bleiben erhalten.',
  });
  if (result.response === 0) {
    autoUpdater.quitAndInstall();
  }
}

export function checkForUpdatesManual(): void {
  store.set('snoozedUntil', 0);
  store.set('snoozedVersion', '');
  void autoUpdater.checkForUpdates().catch((err) => {
    log.error('Manueller Update-Check fehlgeschlagen', err);
  });
}

export function getPendingUpdateVersion(): string | null {
  return pendingVersion;
}
