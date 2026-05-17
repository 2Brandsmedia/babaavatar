const WINDOW_SECONDS = 5;
const BOOTSTRAP_SECONDS = 1.2;
const STABLE_VARIANCE_THRESHOLD = 0.0008;

interface Sample {
  value: number;
  timestamp: number;
}

class RollingMedian {
  private readonly samples: Sample[] = [];

  push(value: number, timestamp: number, windowMs: number): void {
    this.samples.push({ value, timestamp });
    const cutoff = timestamp - windowMs;
    while (this.samples.length > 0 && this.samples[0]!.timestamp < cutoff) {
      this.samples.shift();
    }
  }

  median(): number {
    if (this.samples.length === 0) return 0;
    const sorted = this.samples.map((s) => s.value).sort((a, b) => a - b);
    const mid = sorted.length >>> 1;
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }

  variance(): number {
    if (this.samples.length < 2) return Infinity;
    let sum = 0;
    for (const s of this.samples) sum += s.value;
    const mean = sum / this.samples.length;
    let acc = 0;
    for (const s of this.samples) {
      const d = s.value - mean;
      acc += d * d;
    }
    return acc / this.samples.length;
  }

  count(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
  }
}

export interface CalibrationSnapshot {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  stability: number;
  qualityScore: number;
  bootstrapped: boolean;
}

export interface CalibrationInput {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  poseVisibilityAverage: number;
  handCount: number;
  timestamp: number;
}

export class AutoCalibration {
  private readonly centerX = new RollingMedian();
  private readonly centerY = new RollingMedian();
  private readonly width = new RollingMedian();
  private readonly height = new RollingMedian();
  private firstTimestamp: number | null = null;

  constructor(private readonly windowSeconds: number = WINDOW_SECONDS) {}

  feed(input: CalibrationInput): CalibrationSnapshot {
    if (this.firstTimestamp === null) this.firstTimestamp = input.timestamp;
    const windowMs = this.windowSeconds * 1000;
    this.centerX.push(input.centerX, input.timestamp, windowMs);
    this.centerY.push(input.centerY, input.timestamp, windowMs);
    this.width.push(input.width, input.timestamp, windowMs);
    this.height.push(input.height, input.timestamp, windowMs);

    const elapsedSec = (input.timestamp - this.firstTimestamp) / 1000;
    const bootstrapped = elapsedSec >= BOOTSTRAP_SECONDS && this.centerX.count() >= 30;

    const posVar = (this.centerX.variance() + this.centerY.variance()) / 2;
    const stability = bootstrapped ? clamp01(1 - posVar / STABLE_VARIANCE_THRESHOLD) : 0;

    const widthScore = clamp01((this.width.median() - 0.05) / 0.25);
    const visScore = clamp01(input.poseVisibilityAverage);
    const handScore = input.handCount > 0 ? 1 : 0.5;
    const qualityScore = bootstrapped
      ? 0.45 * widthScore + 0.3 * visScore + 0.15 * stability + 0.1 * handScore
      : 0;

    return {
      centerX: this.centerX.median(),
      centerY: this.centerY.median(),
      width: this.width.median(),
      height: this.height.median(),
      stability,
      qualityScore,
      bootstrapped,
    };
  }

  reset(): void {
    this.centerX.reset();
    this.centerY.reset();
    this.width.reset();
    this.height.reset();
    this.firstTimestamp = null;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
