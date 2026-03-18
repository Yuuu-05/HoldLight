import { useState } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Modal from '../../../shared/components/ui/Modal';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';

interface ContactIntentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export default function ContactIntentModal({ open, onClose, onSubmit }: ContactIntentModalProps) {
  const [message, setMessage] = useState('I am available and happy to support this session.');
  const { t } = useLanguage();
  return (
    <Modal open={open} title={t('Contact intent')} onClose={onClose}>
      <Textarea label={t('Message')} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
      <div className="inline-actions wrap">
        <Button onClick={async () => { await onSubmit(message); onClose(); }}>{t('Send')}</Button>
      </div>
    </Modal>
  );
}
