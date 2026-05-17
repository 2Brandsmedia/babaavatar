import { memo } from 'react';
import { APP_NAME } from '@shared/constants';

export type SidebarSection =
  | 'avatars'
  | 'tracking'
  | 'calibration'
  | 'hotkeys'
  | 'settings';

interface SidebarProps {
  active: SidebarSection;
  onSelect: (section: SidebarSection) => void;
  onShowCredits: () => void;
  avatarCount: number;
}

interface MenuItem {
  id: SidebarSection;
  label: string;
  hint: string;
  step: string;
}

const ITEMS: MenuItem[] = [
  { id: 'avatars', label: 'Avatare', hint: 'Importieren & Auswählen', step: '1' },
  { id: 'tracking', label: 'Live-Tracking', hint: 'Webcam-Vorschau & Status', step: '2' },
  { id: 'calibration', label: 'Kalibrierung', hint: 'Werte anpassen', step: '3' },
  { id: 'hotkeys', label: 'Hotkeys', hint: 'Tasten für Expressions', step: '4' },
  { id: 'settings', label: 'Einstellungen', hint: 'Hintergrund, Output, Performance', step: '5' },
];

export const Sidebar = memo(function Sidebar({
  active,
  onSelect,
  onShowCredits,
  avatarCount,
}: SidebarProps): JSX.Element {
  return (
    <>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #2a2a32' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{APP_NAME}</div>
        <div style={{ fontSize: 11, color: '#6a6a72' }}>VTuber-Tracking für OBS</div>
      </div>

      {avatarCount === 0 && (
        <div
          style={{
            background: '#1c1c2a',
            border: '1px solid #4f46e5',
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: '#a0bcff',
          }}
        >
          <strong>Erster Schritt:</strong> Avatar importieren unter "Avatare".
        </div>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ITEMS.map((item) => (
          <SidebarItem key={item.id} item={item} active={active === item.id} onSelect={onSelect} />
        ))}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          onClick={onShowCredits}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#52525a',
            fontSize: 11,
            textAlign: 'left',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Entwickelt von 2Brands Media GmbH
        </button>
        <div style={{ color: '#3a3a44', fontSize: 10 }}>© 2026 — Für T ♥</div>
      </div>
    </>
  );
});

interface SidebarItemProps {
  item: MenuItem;
  active: boolean;
  onSelect: (section: SidebarSection) => void;
}

const SidebarItem = memo(function SidebarItem({
  item,
  active,
  onSelect,
}: SidebarItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid transparent',
        background: active ? '#1c1c2a' : 'transparent',
        color: active ? '#7aa7ff' : '#e8e8ec',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: active ? '#4f46e5' : '#26262e',
          color: active ? '#fff' : '#a0a0a8',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.step}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{item.label}</span>
        <span style={{ fontSize: 10, color: '#6a6a72' }}>{item.hint}</span>
      </div>
    </button>
  );
});
