import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import type {
  AppSettings,
  AvatarProfile,
  AvatarRecord,
  ExpressionHotkey,
  VrmLicense,
} from '../shared/types.js';

const api = {
  app: {
    isDev: process.env['NODE_ENV'] !== 'production',
    platform: process.platform,
  },

  settings: {
    getAll: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    get: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> =>
      ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  },

  output: {
    open: (): Promise<void> => ipcRenderer.invoke(IPC.OUTPUT_OPEN),
    close: (): Promise<void> => ipcRenderer.invoke(IPC.OUTPUT_CLOSE),
    setAlwaysOnTop: (value: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.OUTPUT_TOGGLE_ALWAYS_ON_TOP, value),
  },

  browser: {
    navigate: (url: string): Promise<void> => ipcRenderer.invoke(IPC.BROWSER_NAVIGATE, url),
    show: (bounds: { x: number; y: number; width: number; height: number }): Promise<void> =>
      ipcRenderer.invoke(IPC.BROWSER_SHOW, bounds),
    hide: (): Promise<void> => ipcRenderer.invoke(IPC.BROWSER_HIDE),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }): Promise<void> =>
      ipcRenderer.invoke(IPC.BROWSER_SET_BOUNDS, bounds),
    back: (): Promise<void> => ipcRenderer.invoke(IPC.BROWSER_BACK),
    forward: (): Promise<void> => ipcRenderer.invoke(IPC.BROWSER_FORWARD),
    reload: (): Promise<void> => ipcRenderer.invoke(IPC.BROWSER_RELOAD),
  },

  curated: {
    download: (payload: { url: string; displayName: string }): Promise<{ buffer: ArrayBuffer; fileName: string }> =>
      ipcRenderer.invoke(IPC.CURATED_DOWNLOAD, payload),
  },

  hotkeys: {
    register: (hotkey: ExpressionHotkey): Promise<boolean> =>
      ipcRenderer.invoke(IPC.HOTKEY_REGISTER, hotkey),
    unregister: (id: string): Promise<void> => ipcRenderer.invoke(IPC.HOTKEY_UNREGISTER, id),
  },

  profiles: {
    get: (avatarId: string): Promise<AvatarProfile> => ipcRenderer.invoke(IPC.PROFILE_GET, avatarId),
    set: (profile: AvatarProfile): Promise<AvatarProfile> =>
      ipcRenderer.invoke(IPC.PROFILE_SET, profile),
  },

  vroid: {
    authState: (): Promise<{ configured: boolean; authenticated: boolean }> =>
      ipcRenderer.invoke(IPC.VROID_AUTH_STATE),
    login: (): Promise<{ authenticated: boolean }> => ipcRenderer.invoke(IPC.VROID_LOGIN),
    logout: (): Promise<void> => ipcRenderer.invoke(IPC.VROID_LOGOUT),
    listCharacters: (): Promise<unknown[]> => ipcRenderer.invoke(IPC.VROID_LIST_CHARACTERS),
  },

  avatars: {
    list: (): Promise<AvatarRecord[]> => ipcRenderer.invoke(IPC.AVATAR_LIST),
    importFile: (payload: {
      buffer: ArrayBuffer;
      fileName: string;
      thumbnailDataUrl?: string;
      sourceUrl?: string;
      displayName?: string;
    }): Promise<AvatarRecord> => ipcRenderer.invoke(IPC.AVATAR_IMPORT_FILE, payload),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.AVATAR_DELETE, id),
    readLicense: (filePath: string): Promise<VrmLicense | null> =>
      ipcRenderer.invoke(IPC.AVATAR_READ_LICENSE, filePath),
    openFolder: (): Promise<void> => ipcRenderer.invoke(IPC.AVATAR_OPEN_FOLDER),
  },

  on: <T = unknown>(channel: string, callback: (data: T) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: T): void => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  ipcChannels: IPC,
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
