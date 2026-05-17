import { memo, useCallback, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { useTracking } from '@renderer/lib/tracking/use-tracking';
import { useLipsync } from '@renderer/lib/audio/use-lipsync';
import { useWebcamStream } from '@renderer/lib/tracking/use-webcam-stream';
import { createPoseChannel } from '@renderer/lib/broadcast/pose-channel';
import { subscribeVmcFrames } from '@renderer/lib/tracking/vmc-channel';
import {
  buildAudioPhonemes,
  buildVmcOnlyFrame,
  enrichTrackingFrame,
} from '@renderer/lib/tracking/pose-enricher';
import { api } from '@renderer/lib/ipc/api';
import type { VmcSnapshot } from '@shared/types';

const VMC_PULSE_INTERVAL_MS = 33;
const PULSE_SKIP_IF_RECENT_MS = 50;
const VMC_FRESHNESS_MS = 2000;

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
  const channelRef = useRef<ReturnType<typeof createPoseChannel> | null>(null);
  if (channelRef.current === null) channelRef.current = createPoseChannel();

  const vmcSnapshotRef = useRef<VmcSnapshot | null>(null);
  const lastPosePushedRef = useRef<number>(0);

  const handleStream = useCallback(
    (stream: MediaStream | null) => setVideoStream(stream),
    [setVideoStream],
  );
  const handleStreamError = useCallback(
    (message: string) => setTrackingState(false, message),
    [setTrackingState],
  );

  const streamRef = useWebcamStream({
    videoRef,
    cameraId,
    enabled: trackingEnabled,
    reloadCounter,
    onStream: handleStream,
    onError: handleStreamError,
  });

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

  const tracking = useTracking({
    video: videoRef.current,
    enabled: trackingEnabled && !!streamRef.current,
  });

  const lipsync = useLipsync({
    deviceId: microphoneId,
    enabled: lipsyncEnabled,
    gain: settings?.micGain ?? 1.4,
    noiseGate: settings?.micNoiseGate ?? 0.06,
    reloadKey: reloadCounter,
  });

  useEffect(() => {
    if (!tracking.pose) return;
    const audioPhonemes = buildAudioPhonemes(lipsync);
    const enriched = enrichTrackingFrame(
      tracking.pose,
      audioPhonemes,
      settings ?? null,
      vmcSnapshotRef.current,
    );
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
      if (!vmc || Date.now() - vmc.receivedAt > VMC_FRESHNESS_MS) return;
      if (performance.now() - lastPosePushedRef.current < PULSE_SKIP_IF_RECENT_MS) return;
      const enriched = buildVmcOnlyFrame(vmc, buildAudioPhonemes(lipsync), settings);
      setPose(enriched);
      channelRef.current?.publish(enriched);
      lastPosePushedRef.current = performance.now();
    }, VMC_PULSE_INTERVAL_MS);
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
