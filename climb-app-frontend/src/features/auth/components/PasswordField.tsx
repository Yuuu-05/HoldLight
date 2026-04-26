import Input from '../../../shared/components/ui/Input';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function PasswordField({ value, onChange, label = 'Password' }: PasswordFieldProps) {
  const { t } = useLanguage();

  return (
    <Input
      label={t(label)}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="current-password"
    />
  );
}
