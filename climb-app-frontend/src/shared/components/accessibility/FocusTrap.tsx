import {
  forwardRef,
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PropsWithChildren,
} from 'react';

interface FocusTrapProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  active: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}

const FocusTrap = forwardRef<HTMLDivElement, FocusTrapProps>(function FocusTrap(
  {
    active,
    onEscape,
    restoreFocus = true,
    children,
    onKeyDown,
    tabIndex = -1,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    restoreFocusRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      const [firstFocusable] = getFocusableElements(localRef.current);
      (firstFocusable ?? localRef.current)?.focus();
    }, 20);

    return () => {
      window.clearTimeout(focusTimer);
      if (restoreFocus) {
        restoreFocusRef.current?.focus();
      }
    };
  }, [active, restoreFocus]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);

    if (event.defaultPrevented || !active) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape?.();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getFocusableElements(localRef.current);
    if (!focusableElements.length) {
      event.preventDefault();
      localRef.current?.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }

    if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  return (
    <div
      {...props}
      ref={(node) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      }}
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
});

export default FocusTrap;
