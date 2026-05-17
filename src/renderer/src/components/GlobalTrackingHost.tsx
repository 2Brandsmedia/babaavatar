import { memo, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { useTracking } from '@renderer/lib/tracking/use-tracking';
import { useLipsync } from '@renderer/lib/audio/use-lipsync';
import { createPoseChannel } from '@renderer/lib/broadcast/pose-channel';
import { resetTrackingEngine } from '@renderer/lib/tracking/mediapipe-setup';

export const GlobalTrackingHost = memo(function GlobalTrackingHost(): JSX.Element {
  const { settings } = useSettingsStore();
  const {
    cameraId,
    microphoneId,
    trackingEnabled,
    lipsyncEnabled,
    reloadCounter,
    setVideoStream,
    setPose,
    setMetrics,
    setTrackingState,
    setLipsyncState,
  } = useTrackingStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof createPoseChannel> | null>(null);
  if (channelRef.current === null) channelRef.current = createPoseChannel();

  const sensitivity = settings?.mouthSensitivity ?? 1;

  useEffect(() => {
    if (!trackingEnabled) {
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
        setVideoStream(stream);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play().catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Webcam-Zugriff fehlgeschlagen';
        setTrackingState(false, message);
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
      setVideoStream(null);
    }
  }, [cameraId, trackingEnabled, reloadCounter, setVideoStream, setTrackingState]);

  const tracking = useTracking({
    video: videoRef.current,
    enabled: trackingEnabled && !!streamRef.current,
  });

  const lipsync = useLipsync({
    deviceId: microphoneId,
    enabled: lipsyncEnabled,
    sensitivity,
    reloadKey: reloadCounter,
  });

  useEffect(() => {
    if (!tracking.pose) return;
    const enriched = {
      ...tracking.pose,
      audioPhonemes: lipsync.ready
        ? {
            A: lipsync.phonemes.a,
            I: lipsync.phonemes.i,
            U: lipsync.phonemes.u,
            E: lipsync.phonemes.e,
            O: lipsync.phonemes.o,
          }
        : null,
    };
    setPose(enriched);
    channelRef.current?.publish(enriched);
  }, [tracking.pose, lipsync.phonemes, lipsync.ready, setPose]);

  useEffect(() => {
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    setMetrics(tracking.metrics);
  }, [tracking.metrics, setMetrics]);

  useEffect(() => {
    setTrackingState(tracking.ready, tracking.error);
  }, [tracking.ready, tracking.error, setTrackingState]);

  useEffect(() => {
    setLipsyncState(lipsync.ready, lipsync.error);
  }, [lipsync.ready, lipsync.error, setLipsyncState]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  );
});
