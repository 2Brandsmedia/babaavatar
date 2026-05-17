import { memo } from 'react';
import type { VrmLicense, VrmLicenseLevel } from '@shared/types';

interface LicenseBadgeProps {
  license: VrmLicense | null;
}

const COLORS: Record<VrmLicenseLevel, { bg: string; fg: string; label: string }> = {
  open: { bg: '#1a3b22', fg: '#7af2c5', label: 'Frei für Streaming' },
  restricted: { bg: '#3b3220', fg: '#ffcf6e', label: 'Eingeschränkt' },
  forbidden: { bg: '#3b1b1b', fg: '#ff7878', label: 'Nutzung verboten' },
};

export const LicenseBadge = memo(function LicenseBadge({
  license,
}: LicenseBadgeProps): JSX.Element {
  if (!license) {
    return (
      <span
        style={{
          display: 'inline-flex',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          background: '#26262e',
          color: '#a0a0a8',
        }}
      >
        Keine Lizenz-Info
      </span>
    );
  }
  const palette = COLORS[license.level];
  return (
    <span
      title={license.notesForUser.join(' · ')}
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {palette.label}
    </span>
  );
});
