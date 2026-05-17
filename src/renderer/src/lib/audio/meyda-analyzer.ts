import Meyda from 'meyda';
import type { MeydaFeaturesObject } from 'meyda';

type MeydaAnalyzerInstance = {
  start: () => void;
  stop: () => void;
};

export interface LipsyncFeatures {
  rms: number;
  loudness: number;
  spectralCentroid: number;
  mfcc: number[];
}

export interface LipsyncAnalyzer {
  start: () => void;
  stop: () => void;
}

export function createLipsyncAnalyzer(
  audioContext: AudioContext,
  source: AudioNode,
  onFeatures: (features: LipsyncFeatures) => void,
): LipsyncAnalyzer {
  let analyzer: MeydaAnalyzerInstance | null = null;
  return {
    start: () => {
      analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source,
        bufferSize: 1024,
        featureExtractors: ['rms', 'loudness', 'spectralCentroid', 'mfcc'],
        callback: (features: MeydaFeaturesObject) => {
          const rms = typeof features['rms'] === 'number' ? features['rms'] : 0;
          const loudness = features['loudness'];
          const loudnessValue =
            loudness && typeof loudness === 'object' && 'total' in loudness
              ? Number(loudness.total)
              : 0;
          const centroid =
            typeof features['spectralCentroid'] === 'number' ? features['spectralCentroid'] : 0;
          const mfcc = Array.isArray(features['mfcc']) ? features['mfcc'] : [];
          onFeatures({
            rms,
            loudness: loudnessValue,
            spectralCentroid: centroid,
            mfcc: mfcc as number[],
          });
        },
      });
      analyzer.start();
    },
    stop: () => {
      analyzer?.stop();
      analyzer = null;
    },
  };
}
