import { BrowserWindow, dialog } from 'electron';
import { createRequire } from 'node:module';
import type { AppUpdater } from 'electron-updater';
import { createLogger } from './logger.js';

const require = createRequire(import.meta.url);
const electronUpdaterPkg: { autoUpdater: AppUpdater } = require('electron-updater');
const { autoUpdater } = electronUpdaterPkg;

const log = createLogger('auto-updater');

interface UpdaterOptions {
  controlWindow: BrowserWindow | null;
}

export function initAutoUpdater({ controlWindow }: UpdaterOptions): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('Suche nach Update');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update verfügbar', { version: info.version });
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('updater:available', { version: info.version });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('Keine neue Version');
  });

  autoUpdater.on('error', (err) => {
    log.error('Updater-Fehler', err);
  });

  autoUpdater.on('download-progress', (progress) => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('updater:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update heruntergeladen', { version: info.version });
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('updater:downloaded', { version: info.version });
    }
    void dialog
      .showMessageBox(controlWindow ?? undefined as never, {
        type: 'info',
        buttons: ['Jetzt neu starten', 'Später'],
        defaultId: 0,
        title: 'Update bereit',
        message: `BabaAvatar ${info.version} ist heruntergeladen.`,
        detail: 'Soll die App jetzt neu gestartet werden, um das Update zu installieren?',
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  void autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('checkForUpdatesAndNotify fehlgeschlagen', err);
  });
}

export function checkForUpdatesManual(): void {
  void autoUpdater.checkForUpdates().catch((err) => {
    log.error('Manueller Update-Check fehlgeschlagen', err);
  });
}
