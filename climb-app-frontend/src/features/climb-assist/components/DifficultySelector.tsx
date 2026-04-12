import Button from '../../../shared/components/ui/Button';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface DifficultySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const levels = ['Beginner', 'Intermediate', 'Advanced'];

export default function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="segmented-control assist-difficulty-selector" role="group" aria-label={t('Choose guidance difficulty')}>
      {levels.map((level) => (
        <Button key={level} variant={value === level ? 'primary' : 'secondary'} onClick={() => onChange(level)}>
          {t(level)}
        </Button>
      ))}
    </div>
  );
}
