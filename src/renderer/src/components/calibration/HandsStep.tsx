import { memo } from 'react';
import { useTrackingStore } from '@renderer/store/tracking';

export const HandsStep = memo(function HandsStep(): JSX.Element {
  const rawLandmarksRef = useTrackingStore((s) => s.rawLandmarksRef);
  const pose = useTrackingStore((s) => s.pose);
  const handsCount = rawLandmarksRef.current?.hands.length ?? 0;
  const armsLeft = pose?.pose?.armsVisible.left ?? false;
  const armsRight = pose?.pose?.armsVisible.right ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0 }}>
        Test des Hand- und Arm-Trackings. Zeige beide Hände vor der Kamera. Hebe abwechselnd den
        linken und rechten Arm, um zu prüfen ob die App die Seiten korrekt unterscheidet
        (Spiegel-Modus berücksichtigt das automatisch).
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          fontSize: 13,
        }}
      >
        <StatusCard label="Hände erkannt" value={`${handsCount} / 2`} ok={handsCount > 0} />
        <StatusCard label="Linker Arm sichtbar" value={armsLeft ? 'Ja' : 'Nein'} ok={armsLeft} />
        <StatusCard
          label="Rechter Arm sichtbar"
          value={armsRight ? 'Ja' : 'Nein'}
          ok={armsRight}
        />
      </div>
      <small style={{ color: '#a0a0a8' }}>
        Wenn deine Hand-Bewegung am Avatar verkehrt herum ankommt: im Tracking-Tab den
        Spiegel-Modus toggeln.
      </small>
    </div>
  );
});

interface StatusCardProps {
  label: string;
  value: string;
  ok: boolean;
}

const StatusCard = memo(function StatusCard({ label, value, ok }: StatusCardProps): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: ok ? '#0d2a1e' : '#1c1c22',
        border: `1px solid ${ok ? '#1a4d36' : '#2a2a32'}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: '#a0a0a8' }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: ok ? '#7af2c5' : '#a0a0a8',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
});
