import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type PropsWithChildren,
} from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from './Button';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  variant?: 'center' | 'sheet';
  panelClassName?: string;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  variant = 'center',
  panelClassName = '',
  children,
}: ModalProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const [firstFocusable] = getFocusableElements(panelRef.current);
      (firstFocusable ?? panelRef.current)?.focus();
    }, 20);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(panelRef.current);
    if (!focusableElements.length) {
      event.preventDefault();
      panelRef.current?.focus();
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
      className={`modal-backdrop modal-backdrop-${variant}`.trim()}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel modal-panel-${variant} ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={`modal-header modal-header-${variant}`.trim()}>
          <div className="stack-sm">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId} className="subtle-text">{description}</p> : null}
          </div>
          <Button className="modal-close-button" variant="ghost" onClick={onClose} aria-label={t('Close dialog')}>
            {t('Close')}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
