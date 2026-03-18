import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export default function Textarea({ label, id, className = '', ...props }: TextareaProps) {
  const textId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="field" htmlFor={textId}>
      <span className="field-label">{label}</span>
      <textarea id={textId} className={`field-input field-textarea ${className}`.trim()} {...props} />
    </label>
  );
}
