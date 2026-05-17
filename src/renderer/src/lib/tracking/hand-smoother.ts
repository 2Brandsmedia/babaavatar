import type { RawLandmark } from '@renderer/store/tracking';
import { OneEuroFilter } from './smoother';

const HAND_LANDMARK_COUNT = 21;
const MIN_CUTOFF = 3.5;
const BETA = 0.06;

interface HandFilterPack {
  filters: Array<{ x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }>;
  lastSeen: number;
}

export class HandSmoother {
  private left: HandFilterPack;
  private right: HandFilterPack;

  constructor() {
    this.left = createPack();
    this.right = createPack();
  }

  smooth(
    hands: Array<{ landmarks: RawLandmark[]; side: 'Left' | 'Right' }>,
    timestamp: number,
  ): Array<{ landmarks: RawLandmark[]; side: 'Left' | 'Right' }> {
    return hands.map((hand) => {
      const pack = hand.side === 'Left' ? this.left : this.right;
      if (timestamp - pack.lastSeen > 250) {
        resetPack(pack);
      }
      pack.lastSeen = timestamp;
      const smoothed: RawLandmark[] = hand.landmarks.map((lm, i) => {
        const filter = pack.filters[i];
        if (!filter || !lm) return lm;
        return {
          x: filter.x.filter(lm.x, timestamp),
          y: filter.y.filter(lm.y, timestamp),
          z: filter.z.filter(lm.z ?? 0, timestamp),
          visibility: lm.visibility,
        };
      });
      return { landmarks: smoothed, side: hand.side };
    });
  }
}

function createPack(): HandFilterPack {
  const filters = [];
  for (let i = 0; i < HAND_LANDMARK_COUNT; i += 1) {
    filters.push({
      x: new OneEuroFilter(MIN_CUTOFF, BETA),
      y: new OneEuroFilter(MIN_CUTOFF, BETA),
      z: new OneEuroFilter(MIN_CUTOFF, BETA),
    });
  }
  return { filters, lastSeen: 0 };
}

function resetPack(pack: HandFilterPack): void {
  pack.filters.forEach((f) => {
    f.x.reset();
    f.y.reset();
    f.z.reset();
  });
}
