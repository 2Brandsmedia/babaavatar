import { memo, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { useTracking } from '@renderer/lib/tracking/use-tracking';
import { useLipsync } from '@renderer/lib/audio/use-lipsync';
import { createPoseChannel } from '@renderer/lib/broadcast/pose-channel';
import { resetTrackingEngine } from '@renderer/lib/tracking/mediapipe-setup';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';
import { mergeVmcIntoPose } from '@renderer/lib/tracking/vmc-merge';
import { api } from '@renderer/lib/ipc/api';
import type { VmcSnapshot } from '@shared/types';

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
    setMicLevel,
  } = useTrackingStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof createPoseChannel> | null>(null);
  if (channelRef.current === null) channelRef.current = createPoseChannel();

  const micGain = settings?.micGain ?? 1.4;
  const micNoiseGate = settings?.micNoiseGate ?? 0.06;
  const vmcSnapshotRef = useRef<VmcSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVmcFrames((snapshot) => {
      vmcSnapshotRef.current = snapshot;
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.vmcEnabled) {
      void api.vmc
        .start({ protocol: settings.vmcProtocol, port: settings.vmcPort })
        .catch(() => undefined);
    } else {
      void api.vmc.stop().catch(() => undefined);
      vmcSnapshotRef.current = null;
    }
  }, [settings?.vmcEnabled, settings?.vmcProtocol, settings?.vmcPort]);

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
    gain: micGain,
    noiseGate: micNoiseGate,
    reloadKey: reloadCounter,
  });

  const lastPosePushedRef = useRef<number>(0);

  useEffect(() => {
    if (!tracking.pose) return;
    let enriched = {
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

    const vmc = vmcSnapshotRef.current;
    if (settings?.vmcEnabled && vmc && Date.now() - vmc.receivedAt < 2000) {
      enriched = mergeVmcIntoPose(enriched, vmc, {
        applyFace: settings.vmcSourceFace,
        applyHead: settings.vmcSourceHead,
      });
    }

    setPose(enriched);
    channelRef.current?.publish(enriched);
    lastPosePushedRef.current = performance.now();
  }, [
    tracking.pose,
    lipsync.phonemes,
    lipsync.ready,
    setPose,
    settings?.vmcEnabled,
    settings?.vmcSourceFace,
    settings?.vmcSourceHead,
  ]);

  useEffect(() => {
    if (!settings?.vmcEnabled) return;
    const interval = window.setInterval(() => {
      const vmc = vmcSnapshotRef.current;
      if (!vmc || Date.now() - vmc.receivedAt > 2000) return;
      if (performance.now() - lastPosePushedRef.current < 50) return;
      const base = {
        timestamp: performance.now(),
        face: {
          head: { x: 0, y: 0, z: 0 },
          eyeL: 1,
          eyeR: 1,
          brow: 0,
          pupilX: 0,
          pupilY: 0,
          gazeX: 0,
          gazeY: 0,
          mouth: { A: 0, I: 0, U: 0, E: 0, O: 0, smile: 0 },
        },
        pose: null,
        hands: null,
        gestures: null,
        faceMetrics: null,
        irisDistanceCm: null,
        blendShapes: null,
        quality: null,
        audioPhonemes: lipsync.ready
          ? {
              A: lipsync.phonemes.a,
              I: lipsync.phonemes.i,
              U: lipsync.phonemes.u,
              E: lipsync.phonemes.e,
              O: lipsync.phonemes.o,
            }
          : null,
        expression: null,
      };
      const enriched = mergeVmcIntoPose(base, vmc, {
        applyFace: settings.vmcSourceFace,
        applyHead: settings.vmcSourceHead,
      });
      setPose(enriched);
      channelRef.current?.publish(enriched);
      lastPosePushedRef.current = performance.now();
    }, 33);
    return () => window.clearInterval(interval);
  }, [
    settings?.vmcEnabled,
    settings?.vmcSourceFace,
    settings?.vmcSourceHead,
    setPose,
    lipsync.phonemes,
    lipsync.ready,
  ]);

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

  useEffect(() => {
    setMicLevel(lipsync.level, lipsync.gateOpen);
  }, [lipsync.level, lipsync.gateOpen, setMicLevel]);

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
