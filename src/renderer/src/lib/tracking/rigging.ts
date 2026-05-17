import * as Kalidokit from 'kalidokit';
import type {
  FaceLandmarkerResult,
  HandLandmarkerResult,
  PoseLandmarkerResult,
  Classifications,
} from '@mediapipe/tasks-vision';
import type {
  BlendShapeMap,
  FaceMetrics,
  FaceRig,
  PoseFrame,
  PoseRig,
  TrackingQuality,
  Vec3,
} from '@shared/types';
import { AutoCalibration } from './auto-calibration';
import { computeIrisDistanceCm } from './iris-distance';

const ARM_VISIBILITY_MIN = 0.75;
const FACE_BASELINE_WIDTH = 0.22;
const POSE_VISIBILITY_KEYPOINTS = [11, 12, 13, 14, 15, 16, 23, 24] as const;

export interface RawTrackingResult {
  face: FaceLandmarkerResult;
  pose: PoseLandmarkerResult;
  hand: HandLandmarkerResult;
}

export interface RiggingContext {
  video: HTMLVideoElement;
  timestamp: number;
  autoCalibration: AutoCalibration;
}

export function framesToPose(raw: RawTrackingResult, ctx: RiggingContext): PoseFrame {
  const faceRawMetrics = computeFaceRawMetrics(raw.face);
  const poseVisibility = computePoseVisibilityAverage(raw.pose);
  const handCount = raw.hand.landmarks?.length ?? 0;
  const blendShapes = extractBlendShapes(raw.face);

  let metrics: FaceMetrics | null = null;
  let quality: TrackingQuality | null = null;

  if (faceRawMetrics) {
    const snapshot = ctx.autoCalibration.feed({
      centerX: faceRawMetrics.centerX,
      centerY: faceRawMetrics.centerY,
      width: faceRawMetrics.width,
      height: faceRawMetrics.height,
      poseVisibilityAverage: poseVisibility,
      handCount,
      timestamp: ctx.timestamp,
    });

    const baseWidth = snapshot.bootstrapped && snapshot.width > 0 ? snapshot.width : FACE_BASELINE_WIDTH;
    metrics = {
      centerX: faceRawMetrics.centerX,
      centerY: faceRawMetrics.centerY,
      width: faceRawMetrics.width,
      height: faceRawMetrics.height,
      baselineWidth: baseWidth,
      relativeCenterX: snapshot.bootstrapped ? faceRawMetrics.centerX - snapshot.centerX : 0,
      relativeCenterY: snapshot.bootstrapped ? faceRawMetrics.centerY - snapshot.centerY : 0,
      relativeScale: snapshot.bootstrapped && snapshot.width > 0 ? faceRawMetrics.width / snapshot.width : 1,
    };

    quality = {
      stability: snapshot.stability,
      qualityScore: snapshot.qualityScore,
      bootstrapped: snapshot.bootstrapped,
      faceCount: 1,
      poseVisibilityAverage: poseVisibility,
      handCount,
    };
  }

  const irisDistanceCm = computeIrisDistanceCm(raw.face.faceLandmarks?.[0], {
    imageWidth: ctx.video.videoWidth || 640,
    imageHeight: ctx.video.videoHeight || 480,
  });

  return {
    timestamp: ctx.timestamp,
    face: solveFace(raw.face, ctx.video),
    pose: solvePose(raw.pose, ctx.video),
    faceMetrics: metrics,
    irisDistanceCm,
    blendShapes,
    quality,
    audioPhonemes: null,
    expression: null,
  };
}

function computeFaceRawMetrics(result: FaceLandmarkerResult): {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} | null {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const noseTip = landmarks[1];
  return {
    centerX: noseTip?.x ?? (minX + maxX) / 2,
    centerY: noseTip?.y ?? (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function computePoseVisibilityAverage(result: PoseLandmarkerResult): number {
  const landmarks = result.landmarks?.[0];
  if (!landmarks || landmarks.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const idx of POSE_VISIBILITY_KEYPOINTS) {
    const lm = landmarks[idx];
    if (lm && typeof lm.visibility === 'number') {
      sum += lm.visibility;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function extractBlendShapes(result: FaceLandmarkerResult): BlendShapeMap | null {
  const list: Classifications[] | undefined = result.faceBlendshapes;
  const first = list?.[0]?.categories;
  if (!first || first.length === 0) return null;
  const map: Record<string, number> = {};
  for (const cat of first) {
    if (cat.categoryName) map[cat.categoryName] = cat.score;
  }
  return map;
}

function solveFace(result: FaceLandmarkerResult, video: HTMLVideoElement): FaceRig | null {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;
  try {
    const solved = Kalidokit.Face.solve(landmarks, {
      runtime: 'mediapipe',
      video,
      smoothBlink: false,
      blinkSettings: [0.25, 0.75],
    });
    if (!solved) return null;
    return {
      head: toVec(solved.head),
      eyeL: clamp01(solved.eye.l),
      eyeR: clamp01(solved.eye.r),
      brow: clamp01(solved.brow),
      pupilX: solved.pupil.x,
      pupilY: solved.pupil.y,
      mouth: {
        A: clamp01(solved.mouth.shape.A),
        I: clamp01(solved.mouth.shape.I),
        U: clamp01(solved.mouth.shape.U),
        E: clamp01(solved.mouth.shape.E),
        O: clamp01(solved.mouth.shape.O),
        smile: 0,
      },
    };
  } catch (err) {
    console.warn('Face-Solver fehlgeschlagen', err);
    return null;
  }
}

function solvePose(result: PoseLandmarkerResult, video: HTMLVideoElement): PoseRig | null {
  const landmarks2d = result.landmarks?.[0];
  const landmarks3d = result.worldLandmarks?.[0];
  if (!landmarks2d || !landmarks3d) return null;
  try {
    const solved = Kalidokit.Pose.solve(landmarks3d, landmarks2d, {
      runtime: 'mediapipe',
      video,
      enableLegs: false,
    });
    if (!solved) return null;

    const armsVisible = computeArmVisibility(landmarks3d);

    return {
      spine: toVec(solved.Spine),
      leftUpperArm: toVec(solved.LeftUpperArm),
      leftLowerArm: toVec(solved.LeftLowerArm),
      rightUpperArm: toVec(solved.RightUpperArm),
      rightLowerArm: toVec(solved.RightLowerArm),
      hipsPosition: toVec(solved.Hips.position),
      hipsWorldPosition: toVec(solved.Hips.worldPosition ?? { x: 0, y: 0, z: 0 }),
      hipsRotation: toVec(solved.Hips.rotation ?? { x: 0, y: 0, z: 0 }),
      armsVisible,
    };
  } catch (err) {
    console.warn('Pose-Solver fehlgeschlagen', err);
    return null;
  }
}

function computeArmVisibility(landmarks: ReadonlyArray<{ visibility?: number }>): {
  left: boolean;
  right: boolean;
} {
  const leftShoulder = landmarks[11]?.visibility ?? 0;
  const leftElbow = landmarks[13]?.visibility ?? 0;
  const leftWrist = landmarks[15]?.visibility ?? 0;
  const rightShoulder = landmarks[12]?.visibility ?? 0;
  const rightElbow = landmarks[14]?.visibility ?? 0;
  const rightWrist = landmarks[16]?.visibility ?? 0;
  return {
    left:
      leftShoulder >= ARM_VISIBILITY_MIN &&
      leftElbow >= ARM_VISIBILITY_MIN &&
      leftWrist >= ARM_VISIBILITY_MIN,
    right:
      rightShoulder >= ARM_VISIBILITY_MIN &&
      rightElbow >= ARM_VISIBILITY_MIN &&
      rightWrist >= ARM_VISIBILITY_MIN,
  };
}

function toVec(value: { x: number; y: number; z: number } | undefined): Vec3 {
  if (!value) return { x: 0, y: 0, z: 0 };
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    z: typeof value.z === 'number' ? value.z : 0,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
