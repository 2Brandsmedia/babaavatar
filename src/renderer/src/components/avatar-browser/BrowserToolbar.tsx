import { memo, useState, type FormEvent } from 'react';

interface BrowserToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}

export const BrowserToolbar = memo(function BrowserToolbar({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onReload,
}: BrowserToolbarProps): JSX.Element {
  const [input, setInput] = useState(currentUrl);

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const url = input.startsWith('http') ? input : `https://${input}`;
    onNavigate(url);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}
    >
      <button type="button" aria-label="Zurück" onClick={onBack}>
        ◀
      </button>
      <button type="button" aria-label="Vorwärts" onClick={onForward}>
        ▶
      </button>
      <button type="button" aria-label="Neu laden" onClick={onReload}>
        ↻
      </button>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://..."
        style={{
          flex: 1,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #2a2a32',
          background: '#15151a',
          color: '#e8e8ec',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
        }}
      />
      <button type="submit">Öffnen</button>
    </form>
  );
});
