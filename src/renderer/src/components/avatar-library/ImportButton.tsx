import { memo, useRef } from 'react';

interface ImportButtonProps {
  onFile: (file: File) => void;
}

export const ImportButton = memo(function ImportButton({ onFile }: ImportButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" className="primary" onClick={() => inputRef.current?.click()}>
        VRM-Datei importieren
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".vrm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </>
  );
});
