import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { triggerHaptic } from '../../lib/haptics';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
}

export default function Button({ variant = 'primary', fullWidth, className = '', children, ...props }: ButtonProps) {
  const { onClick, ...restProps } = props;

  return (
    <button
      className={`btn btn-${variant} ${fullWidth ? 'btn-block' : ''} ${className}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !props.disabled) {
          triggerHaptic(10);
        }
      }}
      {...restProps}
    >
      {children}
    </button>
  );
}
