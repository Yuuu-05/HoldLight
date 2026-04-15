import {
  useEffect,
  useId,
  type PropsWithChildren,
} from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import FocusTrap from '../accessibility/FocusTrap';
import Button from './Button';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  variant?: 'center' | 'sheet';
  panelClassName?: string;
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
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`modal-backdrop modal-backdrop-${variant}`.trim()}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <FocusTrap
        active={open}
        className={`modal-panel modal-panel-${variant} ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(event) => event.stopPropagation()}
        onEscape={onClose}
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
      </FocusTrap>
    </div>
  );
}
