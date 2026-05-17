import { useEffect, useRef, useState } from 'react';

export interface WebcamHookOptions {
  deviceId: string | null;
  enabled: boolean;
  width?: number;
  height?: number;
  frameRate?: number;
}

export interface WebcamHookResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  error: string | null;
  ready: boolean;
}

export function useWebcam(options: WebcamHookOptions): WebcamHookResult {
  const { deviceId, enabled, width = 1280, height = 720, frameRate = 60 } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }

    let cancelled = false;
    setError(null);
    setReady(false);

    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate },
      },
      audio: false,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = next;
        setStream(next);
        const video = videoRef.current;
        if (video) {
          video.srcObject = next;
          video.muted = true;
          await video.play().catch(() => undefined);
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Webcam-Zugriff fehlgeschlagen');
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [deviceId, enabled, width, height, frameRate]);

  function stopStream(): void {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setReady(false);
  }

  return { videoRef, stream, error, ready };
}

export async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export async function listAudioDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}
