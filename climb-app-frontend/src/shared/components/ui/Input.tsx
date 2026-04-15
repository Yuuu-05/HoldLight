import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  description?: string;
  error?: string;
}

export default function Input({
  label,
  hint,
  description,
  error,
  id,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const reactId = useId();
  const inputId = id || `input-${reactId}`;
  const descriptionId = `${inputId}-description`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [
    ariaDescribedBy,
    description ? descriptionId : null,
    hint ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      {description ? <span id={descriptionId} className="field-description">{description}</span> : null}
      <input
        id={inputId}
        className={`field-input ${className}`.trim()}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        {...props}
      />
      {hint ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error">{error}</span> : null}
    </label>
  );
}
