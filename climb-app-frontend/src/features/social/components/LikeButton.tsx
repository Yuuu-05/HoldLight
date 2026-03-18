import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface LikeButtonProps {
  count: number;
  active: boolean;
  onClick: () => void;
}

export default function LikeButton({ count, active, onClick }: LikeButtonProps) {
  const { t } = useLanguage();
  return <Button variant={active ? 'primary' : 'secondary'} onClick={onClick}>{t('Like')} ({count})</Button>;
}
