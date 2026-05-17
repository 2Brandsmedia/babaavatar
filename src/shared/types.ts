export type VrmLicenseLevel = 'open' | 'restricted' | 'forbidden';

export interface VrmLicense {
  level: VrmLicenseLevel;
  allowedUser: string | null;
  commercialUse: string | null;
  violentUse: string | null;
  sexualUse: string | null;
  licenseName: string | null;
  otherPermissionUrl: string | null;
  author: string | null;
  title: string | null;
  version: string | null;
  notesForUser: string[];
}

export interface AvatarRecord {
  id: string;
  fileName: string;
  filePath: string;
  thumbnailDataUrl: string | null;
  license: VrmLicense | null;
  addedAt: number;
  sourceUrl: string | null;
  displayName: string;
}

export interface CuratedAvatar {
  id: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  downloadUrl: string;
  previewUrl: string;
  tags: string[];
}

export interface ExpressionHotkey {
  id: string;
  accelerator: string;
  expressionName: string;
  label: string;
}

export interface AvatarProfile {
  avatarId: string;
  calibration: {
    neutralPose: number[] | null;
    mouthOpenMax: number | null;
    mouthClosedMin: number | null;
    eyeOpenMax: number | null;
    eyeClosedMin: number | null;
    browUpMax: number | null;
    browDownMin: number | null;
    smileMax: number | null;
  };
  cameraPosition: { x: number; y: number; z: number };
  cameraFov: number;
  avatarScale: number;
  hotkeys: ExpressionHotkey[];
}

export interface AppSettings {
  selectedCameraId: string | null;
  selectedMicrophoneId: string | null;
  activeAvatarId: string | null;
  cameraFps: number;
  smoothingFactor: number;
  blinkThreshold: number;
  mouthSensitivity: number;
  idleAnimationEnabled: boolean;
  autoBlinkEnabled: boolean;
  mirrorMode: boolean;
  chromaColor: string;
  outputAlwaysOnTop: boolean;
  uiTheme: 'light' | 'dark';
  vroidAccessToken: string | null;
  firstStartDone: boolean;
  cameraZoom: number;
  cameraOffsetX: number;
  cameraOffsetY: number;
  autoZoomEnabled: boolean;
  autoZoomRefDistance: number;
  autoZoomMin: number;
  autoZoomMax: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FaceRig {
  head: Vec3;
  eyeL: number;
  eyeR: number;
  brow: number;
  pupilX: number;
  pupilY: number;
  mouth: {
    A: number;
    I: number;
    U: number;
    E: number;
    O: number;
    smile: number;
  };
}

export interface PoseRig {
  spine: Vec3;
  leftUpperArm: Vec3;
  leftLowerArm: Vec3;
  rightUpperArm: Vec3;
  rightLowerArm: Vec3;
  hipsPosition: Vec3;
  hipsWorldPosition: Vec3;
  hipsRotation: Vec3;
  armsVisible: {
    left: boolean;
    right: boolean;
  };
}

export interface HandFingerRig {
  proximal: Vec3;
  intermediate: Vec3;
  distal: Vec3;
}

export interface HandRig {
  wrist: Vec3;
  thumb: HandFingerRig;
  index: HandFingerRig;
  middle: HandFingerRig;
  ring: HandFingerRig;
  little: HandFingerRig;
}

export interface HandsRig {
  left: HandRig | null;
  right: HandRig | null;
}

export interface FaceMetrics {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  baselineWidth: number;
  relativeCenterX: number;
  relativeCenterY: number;
  relativeScale: number;
}

export interface TrackingQuality {
  stability: number;
  qualityScore: number;
  bootstrapped: boolean;
  faceCount: number;
  poseVisibilityAverage: number;
  handCount: number;
}

export type BlendShapeMap = Readonly<Record<string, number>>;

export interface PoseFrame {
  timestamp: number;
  face: FaceRig | null;
  pose: PoseRig | null;
  hands: HandsRig | null;
  faceMetrics: FaceMetrics | null;
  irisDistanceCm: number | null;
  blendShapes: BlendShapeMap | null;
  quality: TrackingQuality | null;
  audioPhonemes: {
    A: number;
    I: number;
    U: number;
    E: number;
    O: number;
  } | null;
  expression: {
    name: string;
    weight: number;
  } | null;
}

export interface DownloadProgress {
  id: string;
  filename: string;
  receivedBytes: number;
  totalBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
}
