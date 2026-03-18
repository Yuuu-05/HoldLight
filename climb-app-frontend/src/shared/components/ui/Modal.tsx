import type { PropsWithChildren } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from './Button';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label={t('Close dialog')}>
            {t('Close')}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
