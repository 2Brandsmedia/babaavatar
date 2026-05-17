import { memo, type ReactNode } from 'react';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export const SliderRow = memo(function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderRowProps): JSX.Element {
  const formatted = format ? format(value) : value.toFixed(2);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#7aa7ff', fontFamily: 'ui-monospace, monospace' }}>{formatted}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
});

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  children?: ReactNode;
}

export const ToggleRow = memo(function ToggleRow({
  label,
  value,
  onChange,
  children,
}: ToggleRowProps): JSX.Element {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 13 }}>{label}</span>
      {children}
    </label>
  );
});

interface SelectRowProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  hint?: string;
  onChange: (value: T) => void;
}

export const SelectRow = memo(function SelectRow<T extends string>({
  label,
  value,
  options,
  hint,
  onChange,
}: SelectRowProps<T>): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <small style={{ color: '#a0a0a8', fontSize: 11 }}>{hint}</small>}
    </label>
  );
}) as <T extends string>(props: SelectRowProps<T>) => JSX.Element;
