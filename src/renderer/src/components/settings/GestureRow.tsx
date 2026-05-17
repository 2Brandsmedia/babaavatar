import { memo, useEffect, useRef } from 'react';
import type { GestureAction, GestureName } from '@shared/types';
import { GESTURE_LABELS } from '@shared/constants';
import { useTrackingStore } from '@renderer/store/tracking';
import { triggerExpression } from '@renderer/lib/expression/expression-bus';

const EXPRESSION_CHOICES = ['happy', 'angry', 'sad', 'surprised', 'relaxed'] as const;

interface GestureRowProps {
  name: GestureName;
  action: GestureAction | null;
  onChange: (action: GestureAction | null) => void;
}

export const GestureRow = memo(function GestureRow({
  name,
  action,
  onChange,
}: GestureRowProps): JSX.Element {
  const ledRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const live = useTrackingStore.getState().gestureLiveRef.current.get(name);
      if (ledRef.current) {
        ledRef.current.style.background = live ? '#4ade80' : '#3a3a44';
        ledRef.current.style.boxShadow = live ? '0 0 8px rgba(74,222,128,0.7)' : 'none';
      }
      if (heldRef.current) {
        heldRef.current.textContent = live ? `${Math.round(live.heldMs)} ms` : '–';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [name]);

  const expressionName = action?.type === 'expression' ? action.name : 'none';

  const handleSelect = (value: string): void => {
    if (value === 'none') {
      onChange(null);
    } else {
      onChange({
        type: 'expression',
        name: value,
        durationMs: action?.type === 'expression' ? action.durationMs : 2000,
      });
    }
  };

  const handleTest = (): void => {
    if (action?.type === 'expression') {
      triggerExpression(action.name, { source: 'manual', durationMs: action.durationMs });
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr 60px 160px 60px',
        gap: 8,
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <div
        ref={ledRef}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#3a3a44',
          transition: 'background 80ms linear',
        }}
      />
      <span style={{ fontSize: 13 }}>{GESTURE_LABELS[name]}</span>
      <span
        ref={heldRef}
        style={{
          fontSize: 11,
          color: '#7aa7ff',
          fontFamily: 'ui-monospace, monospace',
          textAlign: 'right',
        }}
      >
        –
      </span>
      <select value={expressionName} onChange={(e) => handleSelect(e.target.value)}>
        <option value="none">keine Aktion</option>
        {EXPRESSION_CHOICES.map((exp) => (
          <option key={exp} value={exp}>{`Expression: ${exp}`}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleTest}
        disabled={!action}
        style={{
          padding: '4px 8px',
          fontSize: 11,
          background: action ? '#22223a' : '#15151a',
          color: action ? '#cfd0d6' : '#52525a',
          border: '1px solid #2a2a32',
          borderRadius: 6,
          cursor: action ? 'pointer' : 'not-allowed',
        }}
      >
        Testen
      </button>
    </div>
  );
});
