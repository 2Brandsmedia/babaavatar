import { useEffect, useRef, type RefObject } from 'react';
import { resetTrackingEngine } from './mediapipe-setup';

export interface UseWebcamStreamOptions {
  videoRef: RefObject<HTMLVideoElement>;
  cameraId: string | null;
  enabled: boolean;
  reloadCounter: number;
  onStream: (stream: MediaStream | null) => void;
  onError: (message: string) => void;
}

export function useWebcamStream(options: UseWebcamStreamOptions): RefObject<MediaStream | null> {
  const streamRef = useRef<MediaStream | null>(null);
  const { videoRef, cameraId, enabled, reloadCounter, onStream, onError } = options;

  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }
    let cancelled = false;
    void resetTrackingEngine().catch(() => undefined);
    navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 },
        },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        onStream(stream);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play().catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Webcam-Zugriff fehlgeschlagen';
        onError(message);
      });

    return () => {
      cancelled = true;
      stopStream();
    };

    function stopStream(): void {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onStream(null);
    }
  }, [cameraId, enabled, reloadCounter, onStream, onError, videoRef]);

  return streamRef;
}
