import { memo, useEffect, useState } from 'react';
import type { CalibrationStep } from './steps';

interface StepHeroProps {
  step: CalibrationStep;
  position: number;
  total: number;
}

export const StepHero = memo(function StepHero({ step, position, total }: StepHeroProps): JSX.Element {
  // Crossfade-Trigger via Key auf der Icon-Box
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(false);
    const t = window.setTimeout(() => setVisible(true), 30);
    return () => window.clearTimeout(t);
  }, [step.id]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '20px 24px',
        background:
          'linear-gradient(135deg, rgba(79,70,229,0.18) 0%, rgba(122,167,255,0.10) 100%)',
        border: '1px solid #2a2a32',
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.25) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        key={step.id}
        style={{
          width: 88,
          height: 88,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1a1a22 0%, #15151a 100%)',
          border: '1px solid #2a2a32',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
          transition: 'opacity 240ms ease, transform 240ms ease',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {step.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: '#7aa7ff',
            fontWeight: 600,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Schritt {position} von {total}
        </div>
        <h2 style={{ margin: 0, fontSize: 22, color: '#e8e8ec' }}>{step.title}</h2>
        <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#a0a0a8', lineHeight: 1.5 }}>
          {step.subtitle}
        </p>
      </div>
    </div>
  );
});
