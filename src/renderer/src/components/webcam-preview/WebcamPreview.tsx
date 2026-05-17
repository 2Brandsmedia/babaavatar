import { memo, useEffect, useRef } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';
import { useSettingsStore } from '@renderer/store/settings';
import { TrackingOverlay } from './TrackingOverlay';
import { SkeletonOverlay } from './SkeletonOverlay';

interface WebcamPreviewProps {
  showOverlay?: boolean;
  showSkeleton?: boolean;
  aspectRatio?: string;
}

export const WebcamPreview = memo(function WebcamPreview({
  showOverlay = true,
  showSkeleton = true,
  aspectRatio = '16 / 9',
}: WebcamPreviewProps): JSX.Element {
  const videoStream = useTrackingStore((state) => state.videoStream);
  const pose = useTrackingStore((state) => state.pose);
  const trackingEnabled = useTrackingStore((state) => state.trackingEnabled);
  const { settings } = useSettingsStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = videoStream;
  }, [videoStream]);

  const mirror = settings?.mirrorMode ?? true;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        background: '#000',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none',
          display: trackingEnabled ? 'block' : 'none',
        }}
      />
      {showSkeleton && trackingEnabled && <SkeletonOverlay mirror={mirror} />}
      {showOverlay && <TrackingOverlay pose={pose} mirror={mirror} />}
      {!trackingEnabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a0a0a8',
            fontSize: 13,
          }}
        >
          Webcam aus. Oben rechts in der Statusleiste einschalten.
        </div>
      )}
    </div>
  );
});
