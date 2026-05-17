import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createControlWindow, createOutputWindow, setWindowRefs } from './windows.js';
import { registerIpcHandlers } from './ipc.js';
import { createLogger, closeLogger } from './logger.js';
import { registerAssetProtocol, registerAssetProtocolPrivileges } from './asset-protocol.js';
import { setBrowserHost } from './browser-view.js';
import { registerDownloadHandler } from './download-handler.js';
import { registerVroidProtocol, handleOpenUrl, focusControlForCallback } from './vroid-api.js';
import { unregisterAll as unregisterHotkeys } from './hotkeys.js';
import { initAutoUpdater } from './auto-updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env['APP_ROOT'] = path.join(__dirname, '..', '..');

const log = createLogger('main');

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.setName('BabaAvatar');

registerAssetProtocolPrivileges();
registerVroidProtocol();

app.on('open-url', (event, url) => {
  event.preventDefault();
  focusControlForCallback();
  handleOpenUrl(url);
});

let controlWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;

function bootstrap(): void {
  log.info('Starte BabaAvatar', { platform: process.platform, version: app.getVersion() });
  controlWindow = createControlWindow();
  outputWindow = createOutputWindow();
  setWindowRefs({ controlWindow, outputWindow });
  setBrowserHost({ parentWindow: controlWindow });
  registerIpcHandlers({ controlWindow, outputWindow });
  registerDownloadHandler();
  if (!process.env['ELECTRON_RENDERER_URL']) {
    initAutoUpdater({ controlWindow });
  }
}

app.whenReady().then(() => {
  registerAssetProtocol();
  bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap();
    }
  });
});

app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith('babaavatar://'));
  if (url) {
    handleOpenUrl(url);
  }
  if (controlWindow) {
    if (controlWindow.isMinimized()) controlWindow.restore();
    controlWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('Beende BabaAvatar');
  unregisterHotkeys();
  closeLogger();
});
