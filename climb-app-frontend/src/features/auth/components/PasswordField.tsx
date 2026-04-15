import Input from '../../../shared/components/ui/Input';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}

export default function PasswordField({
  value,
  onChange,
  label = 'Password',
  id,
  error,
  required,
  autoComplete = 'current-password',
}: PasswordFieldProps) {
  const { t } = useLanguage();

  return (
    <Input
      id={id}
      label={t(label)}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      error={error}
      required={required}
    />
  );
}
