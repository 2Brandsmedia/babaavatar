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
