import { useId, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  description?: string;
  error?: string;
}

export default function Textarea({
  label,
  hint,
  description,
  error,
  id,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: TextareaProps) {
  const reactId = useId();
  const textId = id || `textarea-${reactId}`;
  const descriptionId = `${textId}-description`;
  const hintId = `${textId}-hint`;
  const errorId = `${textId}-error`;
  const describedBy = [
    ariaDescribedBy,
    description ? descriptionId : null,
    hint ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <label className="field" htmlFor={textId}>
      <span className="field-label">{label}</span>
      {description ? <span id={descriptionId} className="field-description">{description}</span> : null}
      <textarea
        id={textId}
        className={`field-input field-textarea ${className}`.trim()}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        {...props}
      />
      {hint ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error">{error}</span> : null}
    </label>
  );
}
