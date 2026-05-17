interface OneEuroState {
  prev: number;
  prevDerivative: number;
  prevTimestamp: number;
}

export class OneEuroFilter {
  private state: OneEuroState | null = null;

  constructor(
    private readonly minCutoff = 1.0,
    private readonly beta = 0.05,
    private readonly dCutoff = 1.0,
  ) {}

  filter(value: number, timestamp: number): number {
    if (!this.state) {
      this.state = { prev: value, prevDerivative: 0, prevTimestamp: timestamp };
      return value;
    }
    const dt = Math.max((timestamp - this.state.prevTimestamp) / 1000, 1e-3);
    const derivative = (value - this.state.prev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const smoothedDerivative = aD * derivative + (1 - aD) * this.state.prevDerivative;
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const a = alpha(cutoff, dt);
    const smoothed = a * value + (1 - a) * this.state.prev;
    this.state = { prev: smoothed, prevDerivative: smoothedDerivative, prevTimestamp: timestamp };
    return smoothed;
  }

  reset(): void {
    this.state = null;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export function createVectorSmoother(dim: number, options?: { minCutoff?: number; beta?: number }): {
  filter: (values: number[], timestamp: number) => number[];
  reset: () => void;
} {
  const filters = Array.from(
    { length: dim },
    () => new OneEuroFilter(options?.minCutoff, options?.beta),
  );
  return {
    filter: (values, timestamp) => {
      if (values.length !== dim) {
        throw new Error(`Smoother erwartet ${dim} Dimensionen, bekam ${values.length}`);
      }
      return values.map((v, i) => {
        const filter = filters[i];
        if (!filter) return v;
        return filter.filter(v, timestamp);
      });
    },
    reset: () => filters.forEach((f) => f.reset()),
  };
}
