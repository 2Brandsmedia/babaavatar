import type { PoseFrame, Vec3 } from '@shared/types';
import { OneEuroFilter } from './smoother';

export class PoseSmoother {
  private filters = new Map<string, OneEuroFilter>();

  constructor(
    private readonly minCutoff = 4.0,
    private readonly beta = 0.05,
  ) {}

  smooth(frame: PoseFrame): PoseFrame {
    const t = frame.timestamp;
    return {
      timestamp: t,
      face: frame.face
        ? {
            head: this.smoothVec('head', frame.face.head, t),
            eyeL: this.filterScalar('eyeL', frame.face.eyeL, t),
            eyeR: this.filterScalar('eyeR', frame.face.eyeR, t),
            brow: this.filterScalar('brow', frame.face.brow, t),
            pupilX: this.filterScalar('pupilX', frame.face.pupilX, t),
            pupilY: this.filterScalar('pupilY', frame.face.pupilY, t),
            mouth: {
              A: this.filterScalar('mA', frame.face.mouth.A, t),
              I: this.filterScalar('mI', frame.face.mouth.I, t),
              U: this.filterScalar('mU', frame.face.mouth.U, t),
              E: this.filterScalar('mE', frame.face.mouth.E, t),
              O: this.filterScalar('mO', frame.face.mouth.O, t),
              smile: this.filterScalar('mSmile', frame.face.mouth.smile, t),
            },
          }
        : null,
      pose: frame.pose
        ? {
            spine: this.smoothVec('spine', frame.pose.spine, t),
            leftUpperArm: this.smoothVec('lUp', frame.pose.leftUpperArm, t),
            leftLowerArm: this.smoothVec('lLo', frame.pose.leftLowerArm, t),
            rightUpperArm: this.smoothVec('rUp', frame.pose.rightUpperArm, t),
            rightLowerArm: this.smoothVec('rLo', frame.pose.rightLowerArm, t),
            hipsPosition: this.smoothVec('hipsPos', frame.pose.hipsPosition, t),
            hipsWorldPosition: this.smoothVec('hipsWorldPos', frame.pose.hipsWorldPosition, t),
            hipsRotation: this.smoothVec('hipsRot', frame.pose.hipsRotation, t),
            armsVisible: frame.pose.armsVisible,
          }
        : null,
      faceMetrics: frame.faceMetrics
        ? {
            centerX: this.filterScalar('fcX', frame.faceMetrics.centerX, t),
            centerY: this.filterScalar('fcY', frame.faceMetrics.centerY, t),
            width: this.filterScalar('fcW', frame.faceMetrics.width, t),
            height: this.filterScalar('fcH', frame.faceMetrics.height, t),
            baselineWidth: frame.faceMetrics.baselineWidth,
            relativeCenterX: this.filterScalar('fcRX', frame.faceMetrics.relativeCenterX, t),
            relativeCenterY: this.filterScalar('fcRY', frame.faceMetrics.relativeCenterY, t),
            relativeScale: this.filterScalar('fcRS', frame.faceMetrics.relativeScale, t),
          }
        : null,
      irisDistanceCm: frame.irisDistanceCm,
      blendShapes: frame.blendShapes,
      quality: frame.quality,
      audioPhonemes: frame.audioPhonemes,
      expression: frame.expression,
    };
  }

  private smoothVec(key: string, vec: Vec3, t: number): Vec3 {
    return {
      x: this.filterScalar(`${key}.x`, vec.x, t),
      y: this.filterScalar(`${key}.y`, vec.y, t),
      z: this.filterScalar(`${key}.z`, vec.z, t),
    };
  }

  private filterScalar(key: string, value: number, timestamp: number): number {
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new OneEuroFilter(this.minCutoff, this.beta);
      this.filters.set(key, filter);
    }
    return filter.filter(value, timestamp);
  }

  reset(): void {
    this.filters.forEach((f) => f.reset());
  }
}
