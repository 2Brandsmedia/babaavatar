import { memo, type ReactNode } from 'react';

interface ControlLayoutProps {
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
}

export const ControlLayout = memo(function ControlLayout({
  sidebar,
  statusBar,
  children,
}: ControlLayoutProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        gap: 0,
      }}
    >
      <aside
        style={{
          gridRow: '1 / 3',
          background: '#15151a',
          borderRight: '1px solid #2a2a32',
          padding: 16,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {sidebar}
      </aside>
      <header style={{ gridColumn: 2, gridRow: 1 }}>{statusBar}</header>
      <main style={{ gridColumn: 2, gridRow: 2, padding: 24, overflowY: 'auto' }}>{children}</main>
    </div>
  );
});
