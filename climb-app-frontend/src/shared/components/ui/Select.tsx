import { useId, type SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  hint?: string;
  description?: string;
  error?: string;
}

export default function Select({
  label,
  options,
  hint,
  description,
  error,
  id,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: SelectProps) {
  const reactId = useId();
  const selectId = id || `select-${reactId}`;
  const descriptionId = `${selectId}-description`;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [
    ariaDescribedBy,
    description ? descriptionId : null,
    hint ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <label className="field" htmlFor={selectId}>
      <span className="field-label">{label}</span>
      {description ? <span id={descriptionId} className="field-description">{description}</span> : null}
      <select
        id={selectId}
        className={`field-input ${className}`.trim()}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error">{error}</span> : null}
    </label>
  );
}
