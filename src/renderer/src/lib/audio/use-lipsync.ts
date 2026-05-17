import { useEffect, useRef, useState } from 'react';
import { startMicrophone, type MicrophoneStream } from './microphone';
import { createLipsyncAnalyzer } from './meyda-analyzer';
import { featuresToPhonemes, type PhonemeWeights } from './phoneme-mapper';

const SILENCE: PhonemeWeights = { a: 0, i: 0, u: 0, e: 0, o: 0 };

export interface UseLipsyncOptions {
  deviceId: string | null;
  enabled: boolean;
  sensitivity: number;
  reloadKey?: number;
}

export interface UseLipsyncResult {
  phonemes: PhonemeWeights;
  error: string | null;
  ready: boolean;
}

export function useLipsync(options: UseLipsyncOptions): UseLipsyncResult {
  const { deviceId, enabled, sensitivity, reloadKey } = options;
  const [phonemes, setPhonemes] = useState<PhonemeWeights>(SILENCE);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const micRef = useRef<MicrophoneStream | null>(null);

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
          const next = featuresToPhonemes(features, sensitivity);
          setPhonemes(next);
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
      setPhonemes(SILENCE);
      setReady(false);
    }
  }, [deviceId, enabled, sensitivity, reloadKey]);

  return { phonemes, error, ready };
}
