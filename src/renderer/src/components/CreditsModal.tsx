import { memo } from 'react';
import { APP_VENDOR, APP_VENDOR_URL } from '@shared/constants';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal = memo(function CreditsModal({
  onClose,
}: CreditsModalProps): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Credits"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1c1c22',
          border: '1px solid #2a2a32',
          borderRadius: 16,
          padding: 32,
          width: 'min(440px, 90vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: '#a0a0a8' }}>Entwickelt von</div>
        <div
          style={{
            background: '#fff',
            color: '#000',
            borderRadius: 12,
            padding: '12px 20px',
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {APP_VENDOR}
        </div>
        <p style={{ margin: 0, color: '#e8e8ec', fontSize: 14 }}>
          Wir bauen digitale Produkte, die begeistern.
        </p>
        <a
          href={APP_VENDOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#4f46e5',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Website besuchen
        </a>
        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid #2a2a32',
            width: '100%',
            color: '#7aa7ff',
            fontSize: 13,
          }}
        >
          Für T ♥ — Der Mann, die Legende
        </div>
        <button
          type="button"
          aria-label="Modal schließen"
          onClick={onClose}
          style={{ marginTop: 8, fontSize: 12 }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
});
