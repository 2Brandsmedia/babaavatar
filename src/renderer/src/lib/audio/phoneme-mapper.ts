import type { LipsyncFeatures } from './meyda-analyzer';

export interface PhonemeWeights {
  a: number;
  i: number;
  u: number;
  e: number;
  o: number;
}

export const SILENT_PHONEMES: PhonemeWeights = { a: 0, i: 0, u: 0, e: 0, o: 0 };

export interface PhonemeMapResult {
  phonemes: PhonemeWeights;
  level: number;
}

export function mapFeaturesToPhonemes(
  features: LipsyncFeatures,
  gain: number,
): PhonemeMapResult {
  const level = clampUnit(features.rms * gain);
  const mfcc = features.mfcc;
  const c1 = mfcc[1] ?? 0;
  const c2 = mfcc[2] ?? 0;
  const c3 = mfcc[3] ?? 0;

  const aWeight = clampUnit(0.5 + c1 * 0.1 - c2 * 0.05);
  const iWeight = clampUnit(0.3 + c2 * 0.1 + features.spectralCentroid / 8000);
  const uWeight = clampUnit(0.3 - c1 * 0.05);
  const eWeight = clampUnit(0.3 + c3 * 0.1);
  const oWeight = clampUnit(0.4 - c2 * 0.05);

  const sum = aWeight + iWeight + uWeight + eWeight + oWeight || 1;
  const phonemes: PhonemeWeights = {
    a: (aWeight / sum) * level,
    i: (iWeight / sum) * level,
    u: (uWeight / sum) * level,
    e: (eWeight / sum) * level,
    o: (oWeight / sum) * level,
  };
  return { phonemes, level };
}

export function scalePhonemes(phonemes: PhonemeWeights, factor: number): PhonemeWeights {
  return {
    a: phonemes.a * factor,
    i: phonemes.i * factor,
    u: phonemes.u * factor,
    e: phonemes.e * factor,
    o: phonemes.o * factor,
  };
}

function clampUnit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
