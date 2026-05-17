import { memo } from 'react';
import type { PoseFrame } from '@shared/types';

interface TrackingOverlayProps {
  pose: PoseFrame | null;
  mirror: boolean;
}

export const TrackingOverlay = memo(function TrackingOverlay({
  pose,
  mirror,
}: TrackingOverlayProps): JSX.Element | null {
  if (!pose) return null;
  const items: string[] = [];

  if (pose.quality) {
    const q = pose.quality;
    const qPct = Math.round(q.qualityScore * 100);
    const sPct = Math.round(q.stability * 100);
    const status = q.bootstrapped ? 'aktiv' : 'kalibriert…';
    items.push(`Tracking: ${status} · Qualität ${qPct}% · Stabilität ${sPct}%`);
    items.push(
      `Pose-Visibility ${(q.poseVisibilityAverage * 100).toFixed(0)}% · Hände ${q.handCount}`,
    );
  }
  if (pose.face) {
    items.push(
      `Kopf: x ${pose.face.head.x.toFixed(2)} y ${pose.face.head.y.toFixed(2)} z ${pose.face.head.z.toFixed(2)}`,
    );
    items.push(`Augen: L ${pose.face.eyeL.toFixed(2)} · R ${pose.face.eyeR.toFixed(2)}`);
    items.push(
      `Mund: A ${pose.face.mouth.A.toFixed(2)} I ${pose.face.mouth.I.toFixed(2)} O ${pose.face.mouth.O.toFixed(2)}`,
    );
  }
  if (pose.faceMetrics) {
    const m = pose.faceMetrics;
    const rx = (m.relativeCenterX ?? 0).toFixed(2);
    const ry = (m.relativeCenterY ?? 0).toFixed(2);
    const rs = (m.relativeScale ?? 1).toFixed(2);
    items.push(`Offset: x ${rx} y ${ry} · Skala ${rs}`);
  }
  if (pose.blendShapes) {
    const count = Object.keys(pose.blendShapes).length;
    items.push(`BlendShapes: ${count} erkannt`);
  }
  if (pose.pose) {
    if (pose.pose.armsVisible.left) items.push('Linker Arm: erkannt');
    if (pose.pose.armsVisible.right) items.push('Rechter Arm: erkannt');
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        bottom: 8,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: mirror ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          lineHeight: 1.5,
          background: 'rgba(0,0,0,0.55)',
          padding: '6px 10px',
          borderRadius: 8,
          color: '#7af2c5',
          maxWidth: '60%',
        }}
      >
        {items.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
});
