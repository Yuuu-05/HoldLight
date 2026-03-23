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
  const { language, t } = useLanguage();

  return (
    <Modal
      open={open}
      title={t('Contact intent')}
      description={
        language === 'zh'
          ? '留下一句简短留言，保持联系轻松而清楚。'
          : 'Leave a short note so the request stays calm and structured.'
      }
      onClose={onClose}
      panelClassName="contact-intent-modal-panel"
    >
      <div className="contact-intent-modal-body">
        <div className="contact-intent-note stack-sm">
          <p className="social-eyebrow">{t('Contact intent')}</p>
          <p className="subtle-text">
            {language === 'zh'
              ? '这不是即时聊天，只是一张轻轻写下的留言便签。'
              : 'This is not instant chat, just a small note pinned to the board.'}
          </p>
        </div>

        <Textarea label={t('Message')} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />

        <div className="inline-actions wrap contact-intent-modal-actions">
          <Button
            onClick={async () => {
              await onSubmit(message);
              onClose();
            }}
          >
            {t('Send')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
