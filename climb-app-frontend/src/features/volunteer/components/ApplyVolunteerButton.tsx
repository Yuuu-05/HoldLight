import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface ApplyVolunteerButtonProps {
  onClick: () => void;
}

export default function ApplyVolunteerButton({ onClick }: ApplyVolunteerButtonProps) {
  const { t } = useLanguage();
  return <Button onClick={onClick}>{t('Express interest')}</Button>;
}
