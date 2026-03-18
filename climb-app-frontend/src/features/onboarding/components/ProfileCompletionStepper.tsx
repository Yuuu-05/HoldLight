import { useLanguage } from '../../../app/providers/LanguageProvider';

interface ProfileCompletionStepperProps {
  completed: number;
  total: number;
}

export default function ProfileCompletionStepper({ completed, total }: ProfileCompletionStepperProps) {
  const { t } = useLanguage();

  return (
    <p className="subtle-text">
      {t('Profile completion:')} {completed}/{total} {t('key fields filled.')}
    </p>
  );
}
