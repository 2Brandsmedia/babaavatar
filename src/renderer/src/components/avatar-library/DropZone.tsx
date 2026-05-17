import { memo, useState, type DragEvent } from 'react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
}

export const DropZone = memo(function DropZone({ onFiles }: DropZoneProps): JSX.Element {
  const [hover, setHover] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setHover(false);
    const files = Array.from(event.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.vrm'),
    );
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!hover) setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${hover ? '#4f46e5' : '#2a2a32'}`,
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        color: hover ? '#7aa7ff' : '#a0a0a8',
        background: hover ? '#1c1c2a' : '#15151a',
        transition: 'all 120ms ease',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>VRM-Datei hierhin ziehen</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Oder über die "Importieren"-Schaltfläche eine Datei auswählen
      </div>
    </div>
  );
});
