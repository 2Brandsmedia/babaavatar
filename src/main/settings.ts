import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { AppSettings } from '../shared/types.js';
import { DEFAULT_CHROMA_COLOR, DEFAULT_TRACKING_SETTINGS } from '../shared/constants.js';
import { createLogger } from './logger.js';

const log = createLogger('settings');

const defaults: AppSettings = {
  selectedCameraId: null,
  selectedMicrophoneId: null,
  activeAvatarId: null,
  cameraFps: DEFAULT_TRACKING_SETTINGS.cameraFps,
  smoothingFactor: DEFAULT_TRACKING_SETTINGS.smoothingFactor,
  blinkThreshold: DEFAULT_TRACKING_SETTINGS.blinkThreshold,
  mouthSensitivity: DEFAULT_TRACKING_SETTINGS.mouthSensitivity,
  idleAnimationEnabled: DEFAULT_TRACKING_SETTINGS.idleAnimationEnabled,
  autoBlinkEnabled: DEFAULT_TRACKING_SETTINGS.autoBlinkEnabled,
  mirrorMode: DEFAULT_TRACKING_SETTINGS.mirrorMode,
  chromaColor: DEFAULT_CHROMA_COLOR,
  outputAlwaysOnTop: false,
  uiTheme: 'dark',
  vroidAccessToken: null,
  firstStartDone: false,
  cameraZoom: 1.0,
  cameraOffsetX: 0,
  cameraOffsetY: 0,
  autoZoomEnabled: true,
  autoZoomRefDistance: 60,
  autoZoomMin: 0.6,
  autoZoomMax: 2.2,
  lipsyncFromCamera: true,
  lipsyncFromMic: true,
  trackingEngine: 'mediapipe',
  showFaceMesh: true,
  armIkEnabled: true,
  handTrackingEnabled: true,
  showPerformanceStats: false,
};

interface StoreSchema extends AppSettings {
  vroidAccessTokenEncrypted: string | null;
}

const store = new Store<StoreSchema>({
  name: 'babaavatar-settings',
  defaults: { ...defaults, vroidAccessTokenEncrypted: null },
});

export function getAll(): AppSettings {
  const raw = store.store;
  return {
    selectedCameraId: raw.selectedCameraId,
    selectedMicrophoneId: raw.selectedMicrophoneId,
    activeAvatarId: raw.activeAvatarId,
    cameraFps: raw.cameraFps,
    smoothingFactor: raw.smoothingFactor,
    blinkThreshold: raw.blinkThreshold,
    mouthSensitivity: raw.mouthSensitivity,
    idleAnimationEnabled: raw.idleAnimationEnabled,
    autoBlinkEnabled: raw.autoBlinkEnabled,
    mirrorMode: raw.mirrorMode,
    chromaColor: raw.chromaColor,
    outputAlwaysOnTop: raw.outputAlwaysOnTop,
    uiTheme: raw.uiTheme,
    vroidAccessToken: decryptToken(raw.vroidAccessTokenEncrypted),
    firstStartDone: raw.firstStartDone,
    cameraZoom: raw.cameraZoom ?? defaults.cameraZoom,
    cameraOffsetX: raw.cameraOffsetX ?? defaults.cameraOffsetX,
    cameraOffsetY: raw.cameraOffsetY ?? defaults.cameraOffsetY,
    autoZoomEnabled: raw.autoZoomEnabled ?? defaults.autoZoomEnabled,
    autoZoomRefDistance: raw.autoZoomRefDistance ?? defaults.autoZoomRefDistance,
    autoZoomMin: raw.autoZoomMin ?? defaults.autoZoomMin,
    autoZoomMax: raw.autoZoomMax ?? defaults.autoZoomMax,
    lipsyncFromCamera: raw.lipsyncFromCamera ?? defaults.lipsyncFromCamera,
    lipsyncFromMic: raw.lipsyncFromMic ?? defaults.lipsyncFromMic,
    trackingEngine: raw.trackingEngine ?? defaults.trackingEngine,
    showFaceMesh: raw.showFaceMesh ?? defaults.showFaceMesh,
    armIkEnabled: raw.armIkEnabled ?? defaults.armIkEnabled,
    handTrackingEnabled: raw.handTrackingEnabled ?? defaults.handTrackingEnabled,
    showPerformanceStats: raw.showPerformanceStats ?? defaults.showPerformanceStats,
  };
}

export function get<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return getAll()[key];
}

export function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (key === 'vroidAccessToken') {
    const token = value as string | null;
    store.set('vroidAccessTokenEncrypted', encryptToken(token));
    return;
  }
  store.set(key, value as StoreSchema[K]);
}

export function reset(): void {
  store.clear();
  log.info('Settings zurückgesetzt');
}

function encryptToken(token: string | null): string | null {
  if (!token) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    log.warn('safeStorage nicht verfügbar — Token wird nicht persistent gespeichert');
    return null;
  }
  return safeStorage.encryptString(token).toString('base64');
}

function decryptToken(encrypted: string | null): string | null {
  if (!encrypted) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch (err) {
    log.error('Token-Entschlüsselung fehlgeschlagen', err);
    return null;
  }
}
