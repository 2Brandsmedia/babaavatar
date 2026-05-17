export const APP_NAME = 'BabaAvatar';
export const APP_TAGLINE = 'VTuber-Tracking für OBS — Made by 2Brands Media';
export const APP_VENDOR = '2Brands Media GmbH';
export const APP_VENDOR_URL = 'https://2brandsmedia.com';
export const DEFAULT_CHROMA_COLOR = '#00B140';

export const DEFAULT_CONTROL_WINDOW = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 640,
} as const;

export const DEFAULT_OUTPUT_WINDOW = {
  width: 1080,
  height: 1080,
  minWidth: 480,
  minHeight: 480,
} as const;

export const AVATAR_BROWSER_SOURCES = [
  {
    id: 'vroid-hub',
    label: 'VRoid Hub',
    url: 'https://hub.vroid.com/en/models',
    description: 'Grösste VRM-Plattform (Pixiv). Tausende kostenlose Avatare.',
  },
  {
    id: 'booth',
    label: 'Booth (Free)',
    url: 'https://booth.pm/en/search/VRM?in_stock=true&sort=new',
    description: '8000+ Community-VRMs, viele kostenlos.',
  },
  {
    id: 'open-source-avatars',
    label: 'Open Source Avatars',
    url: 'https://github.com/ToxSam/open-source-avatars',
    description: 'Kuratierte CC0/MIT-lizenzierte VRMs.',
  },
  {
    id: 'niconi-solid',
    label: 'Niconi Solid',
    url: 'https://3d.nicovideo.jp/',
    description: 'Japanische 3D-Modell-Plattform.',
  },
  {
    id: 'live3d',
    label: 'Live3D Models',
    url: 'https://live3d.io/vtuber-model',
    description: '100+ kostenlose VTuber-Models.',
  },
] as const;

export const SUPPORTED_VRM_EXTENSIONS = ['.vrm'] as const;

export const DEFAULT_TRACKING_SETTINGS = {
  cameraFps: 60,
  smoothingFactor: 0.5,
  blinkThreshold: 0.4,
  mouthSensitivity: 1.0,
  idleAnimationEnabled: true,
  autoBlinkEnabled: true,
  mirrorMode: true,
} as const;

export const GESTURE_LABELS = {
  thumbsUp: 'Daumen hoch',
  fist: 'Faust',
  peace: 'Peace / Victory',
  openPalm: 'Offene Hand',
  wave: 'Winken',
  heart: 'Herz (beide Hände)',
  ok: 'OK-Zeichen',
  pointing: 'Zeigefinger',
} as const;

export const DEFAULT_GESTURE_MAPPINGS = {
  thumbsUp: { type: 'expression', name: 'happy', durationMs: 2000 },
  fist: { type: 'expression', name: 'angry', durationMs: 2000 },
  peace: { type: 'expression', name: 'relaxed', durationMs: 2000 },
  openPalm: { type: 'expression', name: 'surprised', durationMs: 1500 },
  wave: null,
  heart: { type: 'expression', name: 'happy', durationMs: 3000 },
  ok: null,
  pointing: null,
} as const;

export const VMC_DEFAULT_PORT = 39539;
export const IFACIALMOCAP_DEFAULT_PORT = 49983;
export const IFACIALMOCAP_HANDSHAKE_MAGIC =
  'iFacialMocap_sahuasouryya9218sauhuiayeta91555dy3719';

export const FRAME_TARGET_HZ = 60;
export const FRAME_TARGET_INTERVAL_MS = 1000 / FRAME_TARGET_HZ;

export const POSE_SMOOTHER_MIN_CUTOFF = 4.0;
export const POSE_SMOOTHER_BETA = 0.05;

export const RELOAD_DEBOUNCE_MS = 250;
