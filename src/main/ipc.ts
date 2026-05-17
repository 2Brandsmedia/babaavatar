import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import type { AppSettings, AvatarRecord } from '../shared/types.js';
import * as settings from './settings.js';
import * as avatars from './avatars.js';
import { readVrmLicense } from './vrm-license.js';
import {
  toggleOutputAlwaysOnTop,
  openOutputWindow,
  closeOutputWindow,
} from './windows.js';
import {
  navigateBrowser,
  showBrowser,
  hideBrowser,
  setBrowserBounds,
  browserBack,
  browserForward,
  browserReload,
} from './browser-view.js';
import { setDownloadBroadcast } from './download-handler.js';
import { startOAuthFlow, listCharacters, logout, isVroidConfigured } from './vroid-api.js';
import * as profiles from './profiles.js';
import * as hotkeys from './hotkeys.js';
import type { AvatarProfile, ExpressionHotkey } from '../shared/types.js';
import { createLogger } from './logger.js';
import { startVmcServer, stopVmcServer, getVmcStatus, setVmcWindows } from './vmc-server.js';
import os from 'node:os';

interface IpcContext {
  controlWindow: BrowserWindow;
  outputWindow: BrowserWindow;
}

const log = createLogger('ipc');

let ctx: IpcContext | null = null;

export function registerIpcHandlers(context: IpcContext): void {
  ctx = context;
  setDownloadBroadcast((channel, payload) => {
    ctx?.controlWindow.webContents.send(channel, payload);
  });
  hotkeys.setHotkeyTrigger((hotkey) => {
    ctx?.controlWindow.webContents.send(IPC.HOTKEY_TRIGGERED, hotkey);
    ctx?.outputWindow.webContents.send(IPC.HOTKEY_TRIGGERED, hotkey);
  });
  registerSettingsHandlers();
  registerOutputHandlers();
  registerAvatarHandlers();
  registerBrowserHandlers();
  registerVroidHandlers();
  registerProfileHandlers();
  registerHotkeyHandlers();
  registerVmcHandlers();
  setVmcWindows({ controlWindow: context.controlWindow, outputWindow: context.outputWindow });
  log.info('IPC-Handler registriert');
}

function registerVmcHandlers(): void {
  ipcMain.handle(IPC.VMC_START, async (_e, port: number) => {
    await startVmcServer(port);
    return getVmcStatus();
  });
  ipcMain.handle(IPC.VMC_STOP, async () => {
    await stopVmcServer();
    return getVmcStatus();
  });
  ipcMain.handle(IPC.VMC_STATUS, () => getVmcStatus());
  ipcMain.handle(IPC.VMC_LOCAL_IPS, () => {
    const result: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] ?? []) {
        if (info.family === 'IPv4' && !info.internal) result.push(info.address);
      }
    }
    return result;
  });
}

function registerHotkeyHandlers(): void {
  ipcMain.handle(IPC.HOTKEY_REGISTER, (_e, hotkey: ExpressionHotkey) =>
    hotkeys.registerHotkey(hotkey),
  );
  ipcMain.handle(IPC.HOTKEY_UNREGISTER, (_e, id: string) => {
    hotkeys.unregisterHotkey(id);
  });

  ipcMain.handle(
    IPC.CURATED_DOWNLOAD,
    async (
      _e,
      payload: { url: string; displayName: string },
    ): Promise<{ buffer: ArrayBuffer; fileName: string }> => {
      const response = await fetch(payload.url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'BabaAvatar/0.1.0' },
      });
      if (!response.ok) {
        throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const urlPath = new URL(payload.url).pathname;
      const lastSegment = urlPath.split('/').pop() ?? 'avatar.vrm';
      return { buffer, fileName: lastSegment };
    },
  );
}

function registerProfileHandlers(): void {
  ipcMain.handle(IPC.PROFILE_GET, (_e, avatarId: string) => profiles.getProfile(avatarId));
  ipcMain.handle(IPC.PROFILE_SET, (_e, profile: AvatarProfile) => profiles.setProfile(profile));
}

export function broadcastAvatarAdded(record: AvatarRecord): void {
  ctx?.controlWindow.webContents.send(IPC.AVATAR_ADDED, record);
  ctx?.outputWindow.webContents.send(IPC.AVATAR_ADDED, record);
}

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => settings.getAll());

  ipcMain.handle(IPC.SETTINGS_GET, (_e, key: keyof AppSettings) => settings.get(key));

  ipcMain.handle(
    IPC.SETTINGS_SET,
    (_e, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
      settings.set(key, value);
      return settings.getAll();
    },
  );
}

function registerOutputHandlers(): void {
  ipcMain.handle(IPC.OUTPUT_OPEN, () => {
    openOutputWindow();
  });
  ipcMain.handle(IPC.OUTPUT_CLOSE, () => {
    closeOutputWindow();
  });
  ipcMain.handle(IPC.OUTPUT_TOGGLE_ALWAYS_ON_TOP, (_e, value: boolean) => {
    toggleOutputAlwaysOnTop(value);
  });
}

function registerAvatarHandlers(): void {
  ipcMain.handle(IPC.AVATAR_LIST, () => avatars.listAvatars());

  ipcMain.handle(
    IPC.AVATAR_IMPORT_FILE,
    async (
      _e,
      payload: { buffer: ArrayBuffer; fileName: string; thumbnailDataUrl?: string; sourceUrl?: string; displayName?: string },
    ) => {
      const buffer = Buffer.from(payload.buffer);
      const record = await avatars.importAvatarFromBuffer(buffer, payload.fileName, {
        thumbnailDataUrl: payload.thumbnailDataUrl,
        sourceUrl: payload.sourceUrl,
        displayName: payload.displayName,
      });
      broadcastAvatarAdded(record);
      return record;
    },
  );

  ipcMain.handle(IPC.AVATAR_DELETE, async (_e, id: string) => {
    await avatars.deleteAvatar(id);
  });

  ipcMain.handle(IPC.AVATAR_READ_LICENSE, async (_e, filePath: string) =>
    readVrmLicense(filePath),
  );

  ipcMain.handle(IPC.AVATAR_OPEN_FOLDER, () => {
    avatars.openAvatarsFolder();
  });
}

function registerBrowserHandlers(): void {
  ipcMain.handle(IPC.BROWSER_NAVIGATE, (_e, url: string) => {
    navigateBrowser(url);
  });
  ipcMain.handle(
    IPC.BROWSER_SHOW,
    (_e, bounds: { x: number; y: number; width: number; height: number }) => {
      showBrowser(bounds);
    },
  );
  ipcMain.handle(IPC.BROWSER_HIDE, () => {
    hideBrowser();
  });
  ipcMain.handle(
    IPC.BROWSER_SET_BOUNDS,
    (_e, bounds: { x: number; y: number; width: number; height: number }) => {
      setBrowserBounds(bounds);
    },
  );
  ipcMain.handle(IPC.BROWSER_BACK, () => browserBack());
  ipcMain.handle(IPC.BROWSER_FORWARD, () => browserForward());
  ipcMain.handle(IPC.BROWSER_RELOAD, () => browserReload());
}

function registerVroidHandlers(): void {
  ipcMain.handle(IPC.VROID_AUTH_STATE, () => {
    return {
      configured: isVroidConfigured(),
      authenticated: Boolean(settings.get('vroidAccessToken')),
    };
  });
  ipcMain.handle(IPC.VROID_LOGIN, async () => {
    await startOAuthFlow();
    return { authenticated: true };
  });
  ipcMain.handle(IPC.VROID_LOGOUT, () => {
    logout();
  });
  ipcMain.handle(IPC.VROID_LIST_CHARACTERS, () => listCharacters());
}
