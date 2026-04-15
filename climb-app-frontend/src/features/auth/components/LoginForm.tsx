import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { routes } from '../../../shared/constants/routes';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import PasswordField from './PasswordField';

export default function LoginForm() {
  const { login } = useAuth();
  const { announce } = useAccessibility();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const formErrorId = 'login-form-error';

  function validateForm() {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = t('Please enter your email.');
    }

    if (!password.trim()) {
      nextErrors.password = t('Please enter your password.');
    }

    setFieldErrors(nextErrors);

    const firstInvalidFieldId = nextErrors.email ? 'login-email' : nextErrors.password ? 'login-password' : null;
    if (firstInvalidFieldId) {
      announce(nextErrors.email ?? nextErrors.password ?? '');
      window.setTimeout(() => {
        document.getElementById(firstInvalidFieldId)?.focus();
      }, 0);
    }

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!validateForm()) return;

    setLoading(true);

    try {
      await login({ email, password });
      navigate(routes.dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to sign in.');
      setError(message);
      announce(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate aria-describedby={error ? formErrorId : undefined}>
      <Input
        id="login-email"
        label={t('Email')}
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setFieldErrors((current) => ({ ...current, email: undefined }));
        }}
        autoComplete="email"
        required
        error={fieldErrors.email}
      />
      <PasswordField
        id="login-password"
        value={password}
        onChange={(value) => {
          setPassword(value);
          setFieldErrors((current) => ({ ...current, password: undefined }));
        }}
        error={fieldErrors.password}
        required
      />
      {error ? <ErrorState id={formErrorId} message={error} /> : null}
      <Button type="submit" disabled={loading}>
        {loading ? t('Signing in...') : t('Login')}
      </Button>
    </form>
  );
}
