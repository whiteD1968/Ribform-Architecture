import { useEffect, useState } from 'react';
export function Field({
  label,
  value,
  onChange,
  min = -10000,
  max = 10000,
  step = 1,
  unit = 'mm',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Number(value.toFixed(4)))), [value]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() && Number.isFinite(n)) {
      const next = Math.min(max, Math.max(min, n));
      onChange(next);
      setText(String(next));
    } else setText(String(value));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="slider-field">
      <Field {...{ label, value, onChange, min, max, step, unit }} />
      <input
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
