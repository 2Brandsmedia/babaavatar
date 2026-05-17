import { memo } from 'react';
import type { AppSettings } from '@shared/types';
import { useTrackingStore } from '@renderer/store/tracking';
import { SliderRow, ToggleRow } from '@renderer/components/ui/FormRows';

interface CompositionSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const CompositionSettings = memo(function CompositionSettings({
  settings,
  onUpdate,
}: CompositionSettingsProps): JSX.Element {
  const pose = useTrackingStore((state) => state.pose);
  const distanceCm = pose?.irisDistanceCm ?? null;

  const reset = (): void => {
    void onUpdate('cameraZoom', 1);
    void onUpdate('cameraOffsetX', 0);
    void onUpdate('cameraOffsetY', 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SliderRow
        label="Zoom"
        value={settings.cameraZoom}
        min={0.5}
        max={3.0}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => void onUpdate('cameraZoom', v)}
      />
      <SliderRow
        label="Position X"
        value={settings.cameraOffsetX}
        min={-1}
        max={1}
        step={0.05}
        onChange={(v) => void onUpdate('cameraOffsetX', v)}
      />
      <SliderRow
        label="Position Y"
        value={settings.cameraOffsetY}
        min={-1}
        max={1}
        step={0.05}
        onChange={(v) => void onUpdate('cameraOffsetY', v)}
      />
      <button
        type="button"
        onClick={reset}
        style={{
          alignSelf: 'flex-start',
          padding: '6px 12px',
          background: '#2a2a32',
          color: '#a0a0a8',
          border: '1px solid #3a3a44',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Auf Standard zurücksetzen
      </button>

      <div style={{ height: 1, background: '#2a2a32', margin: '8px 0' }} />

      <ToggleRow
        label="Auto-Zoom (Iris-Distanzerkennung)"
        value={settings.autoZoomEnabled}
        onChange={(v) => void onUpdate('autoZoomEnabled', v)}
      />
      <p style={{ margin: 0, fontSize: 12, color: '#a0a0a8', lineHeight: 1.5 }}>
        Schätzt die echte Distanz zur Kamera aus dem Iris-Durchmesser
        (biologisch konstant 11.7 mm) und passt den Zoom kontinuierlich an.
        Funktioniert am besten bei guter Beleuchtung und ohne stark spiegelnde Brille.
      </p>

      {settings.autoZoomEnabled && (
        <>
          <div
            style={{
              padding: '8px 12px',
              background: distanceCm ? '#0d2a1e' : '#2a1e0d',
              border: `1px solid ${distanceCm ? '#1a4d36' : '#4d3a1a'}`,
              borderRadius: 6,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              color: distanceCm ? '#7af2c5' : '#ffb86b',
            }}
          >
            {distanceCm
              ? `Aktuelle Distanz: ~${distanceCm.toFixed(0)} cm`
              : 'Distanz wird ermittelt...'}
          </div>
          <SliderRow
            label="Referenz-Distanz (neutraler Zoom)"
            value={settings.autoZoomRefDistance}
            min={30}
            max={120}
            step={5}
            format={(v) => `${v.toFixed(0)} cm`}
            onChange={(v) => void onUpdate('autoZoomRefDistance', v)}
          />
          <SliderRow
            label="Auto-Zoom Min"
            value={settings.autoZoomMin}
            min={0.3}
            max={1.0}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => void onUpdate('autoZoomMin', v)}
          />
          <SliderRow
            label="Auto-Zoom Max"
            value={settings.autoZoomMax}
            min={1.0}
            max={4.0}
            step={0.1}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => void onUpdate('autoZoomMax', v)}
          />
        </>
      )}
    </div>
  );
});
