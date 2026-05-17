import { useEffect, useRef, useState } from 'react';
import { startMicrophone, type MicrophoneStream } from './microphone';
import { createLipsyncAnalyzer } from './meyda-analyzer';
import {
  mapFeaturesToPhonemes,
  SILENT_PHONEMES,
  type PhonemeWeights,
} from './phoneme-mapper';

const LEVEL_SMOOTHING = 0.35;
const CLOSE_RATIO = 0.7;
const KNEE_WIDTH = 0.02;

export interface UseLipsyncOptions {
  deviceId: string | null;
  enabled: boolean;
  gain: number;
  noiseGate: number;
  reloadKey?: number;
}

export interface LipsyncLevelRef {
  current: { level: number; gateOpen: boolean };
}

export interface UseLipsyncResult {
  phonemes: PhonemeWeights;
  level: number;
  gateOpen: boolean;
  levelRef: LipsyncLevelRef;
  error: string | null;
  ready: boolean;
}

export function useLipsync(options: UseLipsyncOptions): UseLipsyncResult {
  const { deviceId, enabled, reloadKey } = options;
  const [phonemes, setPhonemes] = useState<PhonemeWeights>(SILENT_PHONEMES);
  const [level, setLevel] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const micRef = useRef<MicrophoneStream | null>(null);
  const levelRef = useRef<{ level: number; gateOpen: boolean }>({ level: 0, gateOpen: false });
  const gainRef = useRef(options.gain);
  const gateRef = useRef(options.noiseGate);
  const smoothedLevelRef = useRef(0);
  const gateStateRef = useRef(false);
  const lastUiPushRef = useRef(0);

  gainRef.current = options.gain;
  gateRef.current = options.noiseGate;

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    let cancelled = false;
    setError(null);
    setReady(false);

    startMicrophone(deviceId)
      .then((mic) => {
        if (cancelled) {
          mic.stop();
          return;
        }
        micRef.current = mic;
        const analyzer = createLipsyncAnalyzer(mic.audioContext, mic.sourceNode, (features) => {
          const { phonemes: raw, level: rawLevel } = mapFeaturesToPhonemes(
            features,
            gainRef.current,
          );

          const smoothed =
            smoothedLevelRef.current +
            (rawLevel - smoothedLevelRef.current) * LEVEL_SMOOTHING;
          smoothedLevelRef.current = smoothed;

          const openThreshold = gateRef.current;
          const closeThreshold = openThreshold * CLOSE_RATIO;
          let nextGate = gateStateRef.current;
          if (smoothed >= openThreshold) nextGate = true;
          else if (smoothed <= closeThreshold) nextGate = false;
          gateStateRef.current = nextGate;

          let kneeFactor = 0;
          if (nextGate) {
            const kneeStart = closeThreshold;
            const kneeEnd = kneeStart + KNEE_WIDTH;
            if (smoothed >= kneeEnd) kneeFactor = 1;
            else if (smoothed <= kneeStart) kneeFactor = 0;
            else kneeFactor = (smoothed - kneeStart) / KNEE_WIDTH;
          }

          const gated: PhonemeWeights =
            kneeFactor > 0
              ? {
                  a: raw.a * kneeFactor,
                  i: raw.i * kneeFactor,
                  u: raw.u * kneeFactor,
                  e: raw.e * kneeFactor,
                  o: raw.o * kneeFactor,
                }
              : SILENT_PHONEMES;

          setPhonemes(gated);
          levelRef.current = { level: smoothed, gateOpen: nextGate };

          const now = performance.now();
          if (now - lastUiPushRef.current >= 60) {
            lastUiPushRef.current = now;
            setLevel(smoothed);
            setGateOpen(nextGate);
          }
        });
        analyzer.start();
        setReady(true);

        return () => {
          analyzer.stop();
        };
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Mikrofon-Zugriff fehlgeschlagen');
      });

    return () => {
      cancelled = true;
      cleanup();
    };

    function cleanup(): void {
      if (micRef.current) {
        micRef.current.stop();
        micRef.current = null;
      }
      smoothedLevelRef.current = 0;
      gateStateRef.current = false;
      levelRef.current = { level: 0, gateOpen: false };
      setPhonemes(SILENT_PHONEMES);
      setLevel(0);
      setGateOpen(false);
      setReady(false);
    }
  }, [deviceId, enabled, reloadKey]);

  return { phonemes, level, gateOpen, levelRef, error, ready };
}
