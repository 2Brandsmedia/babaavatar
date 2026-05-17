import * as Kalidokit from 'kalidokit';
import type {
  FaceLandmarkerResult,
  HandLandmarkerResult,
  PoseLandmarkerResult,
  Classifications,
} from '@mediapipe/tasks-vision';
import type {
  ArmWorldPoints,
  BlendShapeMap,
  FaceMetrics,
  FaceRig,
  HandRig,
  HandsRig,
  PoseFrame,
  PoseRig,
  TrackingQuality,
  Vec3,
} from '@shared/types';
import { AutoCalibration } from './auto-calibration';
import { computeIrisDistanceCm } from './iris-distance';

const SHOULDER_ELBOW_MIN = 0.55;
const WRIST_MIN = 0.45;
const FACE_BASELINE_WIDTH = 0.22;
const POSE_VISIBILITY_KEYPOINTS = [11, 12] as const;

export interface RawTrackingResult {
  face: FaceLandmarkerResult;
  pose: PoseLandmarkerResult;
  hand: HandLandmarkerResult;
}

export interface RiggingContext {
  video: HTMLVideoElement;
  timestamp: number;
  autoCalibration: AutoCalibration;
  mirror: boolean;
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

  const hands = solveHands(raw.hand, ctx.mirror);

  return {
    timestamp: ctx.timestamp,
    face: solveFace(raw.face, ctx.video),
    pose: solvePose(raw.pose, ctx.video, ctx.mirror),
    hands,
    faceMetrics: metrics,
    irisDistanceCm,
    blendShapes,
    quality,
    audioPhonemes: null,
    expression: null,
  };
}

function solveHands(handResult: HandLandmarkerResult, mirror: boolean): HandsRig | null {
  const landmarks = handResult.landmarks ?? [];
  const worldLandmarks = handResult.worldLandmarks ?? [];
  const handednesses = handResult.handednesses ?? [];
  if (landmarks.length === 0) return null;

  let left: HandRig | null = null;
  let right: HandRig | null = null;

  for (let i = 0; i < landmarks.length; i += 1) {
    const lm3d = worldLandmarks[i] ?? landmarks[i];
    if (!lm3d) continue;
    const cameraSide = handednesses[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    const avatarSide: 'Left' | 'Right' = mirror
      ? cameraSide === 'Left'
        ? 'Right'
        : 'Left'
      : cameraSide;
    try {
      const solved = Kalidokit.Hand.solve(lm3d, avatarSide) as Record<string, { x: number; y: number; z: number }> | undefined;
      if (!solved) continue;
      const rig = buildHandRig(solved, avatarSide);
      if (avatarSide === 'Left') left = rig;
      else right = rig;
    } catch (err) {
      console.warn('Hand-Solver fehlgeschlagen', err);
    }
  }

  if (!left && !right) return null;
  return { left, right };
}

function buildHandRig(
  solved: Record<string, { x: number; y: number; z: number }>,
  side: 'Left' | 'Right',
): HandRig {
  return {
    wrist: toVec(solved[`${side}Wrist`]),
    thumb: {
      proximal: toVec(solved[`${side}ThumbProximal`]),
      intermediate: toVec(solved[`${side}ThumbIntermediate`]),
      distal: toVec(solved[`${side}ThumbDistal`]),
    },
    index: {
      proximal: toVec(solved[`${side}IndexProximal`]),
      intermediate: toVec(solved[`${side}IndexIntermediate`]),
      distal: toVec(solved[`${side}IndexDistal`]),
    },
    middle: {
      proximal: toVec(solved[`${side}MiddleProximal`]),
      intermediate: toVec(solved[`${side}MiddleIntermediate`]),
      distal: toVec(solved[`${side}MiddleDistal`]),
    },
    ring: {
      proximal: toVec(solved[`${side}RingProximal`]),
      intermediate: toVec(solved[`${side}RingIntermediate`]),
      distal: toVec(solved[`${side}RingDistal`]),
    },
    little: {
      proximal: toVec(solved[`${side}LittleProximal`]),
      intermediate: toVec(solved[`${side}LittleIntermediate`]),
      distal: toVec(solved[`${side}LittleDistal`]),
    },
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
    const gaze = computeIrisGaze(landmarks);
    return {
      head: toVec(solved.head),
      eyeL: clamp01(solved.eye.l),
      eyeR: clamp01(solved.eye.r),
      brow: clamp01(solved.brow),
      pupilX: solved.pupil.x,
      pupilY: solved.pupil.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
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

function computeIrisGaze(
  landmarks: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftTop = landmarks[159];
  const leftBottom = landmarks[145];
  const rightOuter = landmarks[362];
  const rightInner = landmarks[263];
  const rightTop = landmarks[386];
  const rightBottom = landmarks[374];

  if (!leftIris || !rightIris || !leftOuter || !leftInner || !leftTop || !leftBottom
      || !rightOuter || !rightInner || !rightTop || !rightBottom) {
    return { x: 0, y: 0 };
  }

  const lcx = (leftOuter.x + leftInner.x) / 2;
  const lcy = (leftTop.y + leftBottom.y) / 2;
  const lw = Math.abs(leftInner.x - leftOuter.x) / 2 || 0.0001;
  const lh = Math.abs(leftBottom.y - leftTop.y) / 2 || 0.0001;
  const lgx = (leftIris.x - lcx) / lw;
  const lgy = (leftIris.y - lcy) / lh;

  const rcx = (rightOuter.x + rightInner.x) / 2;
  const rcy = (rightTop.y + rightBottom.y) / 2;
  const rw = Math.abs(rightInner.x - rightOuter.x) / 2 || 0.0001;
  const rh = Math.abs(rightBottom.y - rightTop.y) / 2 || 0.0001;
  const rgx = (rightIris.x - rcx) / rw;
  const rgy = (rightIris.y - rcy) / rh;

  return {
    x: clamp((lgx + rgx) / 2, -1, 1),
    y: clamp((lgy + rgy) / 2, -1, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function solvePose(result: PoseLandmarkerResult, video: HTMLVideoElement, mirror: boolean): PoseRig | null {
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

    const armsVisible = computeArmVisibility(landmarks3d, mirror);

    const leftUpper = mirror ? solved.RightUpperArm : solved.LeftUpperArm;
    const leftLower = mirror ? solved.RightLowerArm : solved.LeftLowerArm;
    const rightUpper = mirror ? solved.LeftUpperArm : solved.RightUpperArm;
    const rightLower = mirror ? solved.LeftLowerArm : solved.RightLowerArm;

    const leftArmWorld = buildArmWorld(landmarks3d, mirror ? 'cam-right' : 'cam-left', mirror, armsVisible.left);
    const rightArmWorld = buildArmWorld(landmarks3d, mirror ? 'cam-left' : 'cam-right', mirror, armsVisible.right);

    return {
      spine: toVec(solved.Spine),
      leftUpperArm: toVec(leftUpper),
      leftLowerArm: toVec(leftLower),
      rightUpperArm: toVec(rightUpper),
      rightLowerArm: toVec(rightLower),
      hipsPosition: toVec(solved.Hips.position),
      hipsWorldPosition: toVec(solved.Hips.worldPosition ?? { x: 0, y: 0, z: 0 }),
      hipsRotation: toVec(solved.Hips.rotation ?? { x: 0, y: 0, z: 0 }),
      armsVisible,
      leftArmWorld,
      rightArmWorld,
    };
  } catch (err) {
    console.warn('Pose-Solver fehlgeschlagen', err);
    return null;
  }
}

function buildArmWorld(
  landmarks3d: ReadonlyArray<{ x?: number; y?: number; z?: number; visibility?: number }>,
  camSide: 'cam-left' | 'cam-right',
  mirror: boolean,
  visible: boolean,
): ArmWorldPoints | null {
  const shoulderIdx = camSide === 'cam-left' ? 11 : 12;
  const elbowIdx = camSide === 'cam-left' ? 13 : 14;
  const wristIdx = camSide === 'cam-left' ? 15 : 16;

  const s = landmarks3d[shoulderIdx];
  const e = landmarks3d[elbowIdx];
  const w = landmarks3d[wristIdx];
  if (!s || !e || !w) return null;

  return {
    shoulder: mpToThree(s, mirror),
    elbow: mpToThree(e, mirror),
    wrist: mpToThree(w, mirror),
    visible,
  };
}

function mpToThree(
  lm: { x?: number; y?: number; z?: number },
  mirror: boolean,
): Vec3 {
  const x = typeof lm.x === 'number' ? lm.x : 0;
  const y = typeof lm.y === 'number' ? lm.y : 0;
  const z = typeof lm.z === 'number' ? lm.z : 0;
  return {
    x: mirror ? -x : x,
    y: -y,
    z: -z,
  };
}

function computeArmVisibility(
  landmarks: ReadonlyArray<{ visibility?: number }>,
  mirror: boolean,
): { left: boolean; right: boolean } {
  // MediaPipe-Indices sind kamera-zentriert: 11/13/15 = "linke" Schulter/Ellbogen/Hand
  // im Webcam-Bild (anatomisch rechte Seite des Users). Bei Mirror=true
  // tauschen wir die Seiten, damit "Avatar-Links" zu "User-Bild-Links" wird.
  const camLeftShoulder = landmarks[11]?.visibility ?? 0;
  const camLeftElbow = landmarks[13]?.visibility ?? 0;
  const camLeftWrist = landmarks[15]?.visibility ?? 0;
  const camRightShoulder = landmarks[12]?.visibility ?? 0;
  const camRightElbow = landmarks[14]?.visibility ?? 0;
  const camRightWrist = landmarks[16]?.visibility ?? 0;

  const leftShoulder = mirror ? camRightShoulder : camLeftShoulder;
  const leftElbow = mirror ? camRightElbow : camLeftElbow;
  const leftWrist = mirror ? camRightWrist : camLeftWrist;
  const rightShoulder = mirror ? camLeftShoulder : camRightShoulder;
  const rightElbow = mirror ? camLeftElbow : camRightElbow;
  const rightWrist = mirror ? camLeftWrist : camRightWrist;

  return {
    left:
      (leftShoulder >= SHOULDER_ELBOW_MIN && leftElbow >= SHOULDER_ELBOW_MIN) ||
      leftWrist >= WRIST_MIN,
    right:
      (rightShoulder >= SHOULDER_ELBOW_MIN && rightElbow >= SHOULDER_ELBOW_MIN) ||
      rightWrist >= WRIST_MIN,
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
