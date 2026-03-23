import type { MouseEvent, PropsWithChildren } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { triggerHaptic } from '../../lib/haptics';

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return Boolean(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

export default function TransitionLink({
  children,
  onClick,
  to,
  target,
  ...props
}: PropsWithChildren<LinkProps>) {
  const navigate = useNavigate();

  return (
    <Link
      to={to}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        triggerHaptic(8);

        const supportsTransition =
          typeof document !== 'undefined' &&
          typeof (document as Document & { startViewTransition?: (callback: () => void) => void }).startViewTransition === 'function';

        if (!supportsTransition || typeof to !== 'string' || target === '_blank' || isModifiedEvent(event)) {
          return;
        }

        event.preventDefault();
        (document as Document & { startViewTransition: (callback: () => void) => void }).startViewTransition(
          () => navigate(to),
        );
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
