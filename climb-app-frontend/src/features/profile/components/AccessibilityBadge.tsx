import Badge from '../../../shared/components/ui/Badge';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface AccessibilityBadgeProps {
  text?: string;
}

export default function AccessibilityBadge({ text }: AccessibilityBadgeProps) {
  const { t } = useLanguage();
  return <Badge>{text ? t(text) : t('No accessibility note yet')}</Badge>;
}
