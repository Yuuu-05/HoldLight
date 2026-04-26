import Button from '../ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface VoiceCommandButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export default function VoiceCommandButton({
  onClick,
  active,
  disabled,
}: VoiceCommandButtonProps) {
  const { t } = useLanguage();
  return (
    <Button
      variant={active ? 'primary' : 'secondary'}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
    >
      {active ? t('Listening...') : t('Start voice command')}
    </Button>
  );
}
