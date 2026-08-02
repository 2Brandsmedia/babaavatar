import type { ArmWorldPoints, HandRig, HandsRig, PoseFrame, Vec3 } from '@shared/types';
import { OneEuroFilter } from './smoother';

// Confidence-adaptive Spanne: sicheres Glied (1.0) filtert mit dem vollen minCutoff
// (reaktiv), unsicheres (0.0) fällt auf einen trägen Filter zurück, der Zittern schluckt.
const ADAPTIVE_MIN = 0.6;

export class PoseSmoother {
  private filters = new Map<string, OneEuroFilter>();

  constructor(
    private readonly minCutoff = 4.0,
    private readonly beta = 0.05,
  ) {}

  private adaptiveParams(confidence: number): { minCutoff: number; beta: number } {
    const c = Math.max(0, Math.min(1, confidence));
    const minCutoff = ADAPTIVE_MIN + (this.minCutoff - ADAPTIVE_MIN) * c;
    return { minCutoff, beta: this.beta * (0.3 + 0.7 * c) };
  }

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
            gazeX: this.filterScalar('gazeX', frame.face.gazeX, t),
            gazeY: this.filterScalar('gazeY', frame.face.gazeY, t),
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
            leftUpperArm: this.smoothVec('lUp', frame.pose.leftUpperArm, t, frame.pose.armConfidence.left),
            leftLowerArm: this.smoothVec('lLo', frame.pose.leftLowerArm, t, frame.pose.armConfidence.left),
            rightUpperArm: this.smoothVec('rUp', frame.pose.rightUpperArm, t, frame.pose.armConfidence.right),
            rightLowerArm: this.smoothVec('rLo', frame.pose.rightLowerArm, t, frame.pose.armConfidence.right),
            hipsPosition: this.smoothVec('hipsPos', frame.pose.hipsPosition, t),
            hipsWorldPosition: this.smoothVec('hipsWorldPos', frame.pose.hipsWorldPosition, t),
            hipsRotation: this.smoothVec('hipsRot', frame.pose.hipsRotation, t),
            armsVisible: frame.pose.armsVisible,
            leftArmWorld: this.smoothArmWorld('lArmW', frame.pose.leftArmWorld, t, frame.pose.armConfidence.left),
            rightArmWorld: this.smoothArmWorld('rArmW', frame.pose.rightArmWorld, t, frame.pose.armConfidence.right),
            leftUpperLeg: this.smoothNullableVec('lUpLeg', frame.pose.leftUpperLeg, t, frame.pose.legConfidence.left),
            leftLowerLeg: this.smoothNullableVec('lLoLeg', frame.pose.leftLowerLeg, t, frame.pose.legConfidence.left),
            rightUpperLeg: this.smoothNullableVec('rUpLeg', frame.pose.rightUpperLeg, t, frame.pose.legConfidence.right),
            rightLowerLeg: this.smoothNullableVec('rLoLeg', frame.pose.rightLowerLeg, t, frame.pose.legConfidence.right),
            legsVisible: frame.pose.legsVisible,
            armConfidence: frame.pose.armConfidence,
            legConfidence: frame.pose.legConfidence,
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
      hands: this.smoothHands(frame.hands, t),
      gestures: frame.gestures,
      irisDistanceCm: frame.irisDistanceCm,
      blendShapes: frame.blendShapes,
      quality: frame.quality,
      audioPhonemes: frame.audioPhonemes,
      expression: frame.expression,
    };
  }

  // Richtungsvektor-Filterung statt Positions-Filterung: Es wird nur die RICHTUNG
  // Schulter→Ellbogen bzw. Ellbogen→Handgelenk geglättet und der Punkt mit der
  // ORIGINAL-Länge rekonstruiert. Effekt: Gliedmaßenlängen bleiben exakt konstant —
  // kein „Gummiarm" mehr, wenn die Filter der drei Punkte auseinanderlaufen.
  private smoothArmWorld(
    prefix: string,
    arm: ArmWorldPoints | null,
    t: number,
    confidence?: number,
  ): ArmWorldPoints | null {
    if (!arm) return null;
    const shoulder = this.smoothVec(`${prefix}S`, arm.shoulder, t, confidence);
    const elbow = this.reconstructAlongDirection(
      `${prefix}E`,
      shoulder,
      arm.shoulder,
      arm.elbow,
      t,
      confidence,
    );
    const wrist = this.reconstructAlongDirection(
      `${prefix}W`,
      elbow,
      arm.elbow,
      arm.wrist,
      t,
      confidence,
    );
    return { shoulder, elbow, wrist, visible: arm.visible };
  }

  private reconstructAlongDirection(
    key: string,
    smoothedOrigin: Vec3,
    rawOrigin: Vec3,
    rawTarget: Vec3,
    t: number,
    confidence?: number,
  ): Vec3 {
    const dx = rawTarget.x - rawOrigin.x;
    const dy = rawTarget.y - rawOrigin.y;
    const dz = rawTarget.z - rawOrigin.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < 1e-6) return { ...smoothedOrigin };
    const dir = this.smoothVec(
      `${key}.dir`,
      { x: dx / length, y: dy / length, z: dz / length },
      t,
      confidence,
    );
    const dirLength = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (dirLength < 1e-6) return { ...smoothedOrigin };
    return {
      x: smoothedOrigin.x + (dir.x / dirLength) * length,
      y: smoothedOrigin.y + (dir.y / dirLength) * length,
      z: smoothedOrigin.z + (dir.z / dirLength) * length,
    };
  }

  private smoothHands(hands: HandsRig | null, t: number): HandsRig | null {
    if (!hands) return null;
    return {
      left: hands.left ? this.smoothHand(hands.left, 'L', t) : null,
      right: hands.right ? this.smoothHand(hands.right, 'R', t) : null,
    };
  }

  private smoothHand(hand: HandRig, prefix: string, t: number): HandRig {
    return {
      wrist: this.smoothVec(`${prefix}Wr`, hand.wrist, t),
      thumb: {
        proximal: this.smoothVec(`${prefix}TP`, hand.thumb.proximal, t),
        intermediate: this.smoothVec(`${prefix}TI`, hand.thumb.intermediate, t),
        distal: this.smoothVec(`${prefix}TD`, hand.thumb.distal, t),
      },
      index: {
        proximal: this.smoothVec(`${prefix}IP`, hand.index.proximal, t),
        intermediate: this.smoothVec(`${prefix}II`, hand.index.intermediate, t),
        distal: this.smoothVec(`${prefix}ID`, hand.index.distal, t),
      },
      middle: {
        proximal: this.smoothVec(`${prefix}MP`, hand.middle.proximal, t),
        intermediate: this.smoothVec(`${prefix}MI`, hand.middle.intermediate, t),
        distal: this.smoothVec(`${prefix}MD`, hand.middle.distal, t),
      },
      ring: {
        proximal: this.smoothVec(`${prefix}RP`, hand.ring.proximal, t),
        intermediate: this.smoothVec(`${prefix}RI`, hand.ring.intermediate, t),
        distal: this.smoothVec(`${prefix}RD`, hand.ring.distal, t),
      },
      little: {
        proximal: this.smoothVec(`${prefix}LP`, hand.little.proximal, t),
        intermediate: this.smoothVec(`${prefix}LI`, hand.little.intermediate, t),
        distal: this.smoothVec(`${prefix}LD`, hand.little.distal, t),
      },
    };
  }

  private smoothNullableVec(
    key: string,
    vec: Vec3 | null,
    t: number,
    confidence?: number,
  ): Vec3 | null {
    if (!vec) return null;
    return this.smoothVec(key, vec, t, confidence);
  }

  private smoothVec(key: string, vec: Vec3, t: number, confidence?: number): Vec3 {
    return {
      x: this.filterScalar(`${key}.x`, vec.x, t, confidence),
      y: this.filterScalar(`${key}.y`, vec.y, t, confidence),
      z: this.filterScalar(`${key}.z`, vec.z, t, confidence),
    };
  }

  private filterScalar(key: string, value: number, timestamp: number, confidence?: number): number {
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new OneEuroFilter(this.minCutoff, this.beta);
      this.filters.set(key, filter);
    }
    if (typeof confidence === 'number') {
      const params = this.adaptiveParams(confidence);
      filter.setParams(params.minCutoff, params.beta);
    }
    return filter.filter(value, timestamp);
  }

  reset(): void {
    this.filters.forEach((f) => f.reset());
  }
}
