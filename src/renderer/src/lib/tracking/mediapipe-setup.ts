import {
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export interface TrackingEngine {
  face: FaceLandmarker;
  pose: PoseLandmarker;
  hand: HandLandmarker;
  dispose: () => void;
}

let cachedEnginePromise: Promise<TrackingEngine> | null = null;

export function getTrackingEngine(): Promise<TrackingEngine> {
  if (!cachedEnginePromise) {
    cachedEnginePromise = initializeEngine();
  }
  return cachedEnginePromise;
}

export async function resetTrackingEngine(): Promise<void> {
  if (cachedEnginePromise) {
    try {
      const engine = await cachedEnginePromise;
      engine.dispose();
    } catch {
      // Engine konnte nicht sauber geschlossen werden — egal, wir bauen neu
    }
  }
  cachedEnginePromise = null;
}

async function initializeEngine(): Promise<TrackingEngine> {
  const resolver = await FilesetResolver.forVisionTasks(WASM_URL);

  const [face, pose, hand] = await Promise.all([
    FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    }),
    PoseLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    }),
    HandLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
    }),
  ]);

  return {
    face,
    pose,
    hand,
    dispose: () => {
      face.close();
      pose.close();
      hand.close();
      cachedEnginePromise = null;
    },
  };
}
