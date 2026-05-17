import type { FaceMetrics, PoseFrame, TrackingQuality } from '@shared/types';
import { computeIrisDistanceCm } from './iris-distance';
import { FACE_BASELINE_WIDTH, type RawTrackingResult, type RiggingContext } from './rigging-common';
import { computeFaceRawMetrics, extractBlendShapes, solveFace } from './rigging-face';
import { solveHands } from './rigging-hands';
import { computePoseVisibilityAverage, solvePose } from './rigging-pose';

export type { RawTrackingResult, RiggingContext } from './rigging-common';

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

    const baseWidth =
      snapshot.bootstrapped && snapshot.width > 0 ? snapshot.width : FACE_BASELINE_WIDTH;
    metrics = {
      centerX: faceRawMetrics.centerX,
      centerY: faceRawMetrics.centerY,
      width: faceRawMetrics.width,
      height: faceRawMetrics.height,
      baselineWidth: baseWidth,
      relativeCenterX: snapshot.bootstrapped ? faceRawMetrics.centerX - snapshot.centerX : 0,
      relativeCenterY: snapshot.bootstrapped ? faceRawMetrics.centerY - snapshot.centerY : 0,
      relativeScale:
        snapshot.bootstrapped && snapshot.width > 0 ? faceRawMetrics.width / snapshot.width : 1,
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
    pose: solvePose(raw.pose, ctx.video, ctx.mirror),
    hands: solveHands(raw.hand, ctx.mirror),
    gestures: null,
    faceMetrics: metrics,
    irisDistanceCm,
    blendShapes,
    quality,
    audioPhonemes: null,
    expression: null,
  };
}
