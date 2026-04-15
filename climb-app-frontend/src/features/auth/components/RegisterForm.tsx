import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import ErrorState from '../../../shared/components/feedback/ErrorState';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import type { RoleValue } from '../../../shared/constants/roles';
import { routes } from '../../../shared/constants/routes';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import PasswordField from './PasswordField';
import RoleSelector from './RoleSelector';
import { getOnboardingStartRoute } from '../../../shared/utils/onboarding';

export default function RegisterForm() {
  const { register } = useAuth();
  const { announce } = useAccessibility();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleValue>('new_user');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const formErrorId = 'register-form-error';

  function validateForm() {
    const nextErrors: { username?: string; email?: string; password?: string } = {};

    if (!username.trim()) {
      nextErrors.username = t('Please enter a username.');
    }

    if (!email.trim()) {
      nextErrors.email = t('Please enter your email.');
    }

    if (!password.trim()) {
      nextErrors.password = t('Please create a password.');
    }

    setFieldErrors(nextErrors);

    const firstInvalidFieldId = nextErrors.username
      ? 'register-username'
      : nextErrors.email
        ? 'register-email'
        : nextErrors.password
          ? 'register-password'
          : null;

    if (firstInvalidFieldId) {
      announce(nextErrors.username ?? nextErrors.email ?? nextErrors.password ?? '');
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
      await register({ username, email, password, role });
      navigate(getOnboardingStartRoute(role), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to create account.');
      setError(message);
      announce(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate aria-describedby={error ? formErrorId : undefined}>
      <Input
        id="register-username"
        label={t('Username')}
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setFieldErrors((current) => ({ ...current, username: undefined }));
        }}
        autoComplete="username"
        required
        error={fieldErrors.username}
      />
      <Input
        id="register-email"
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
        id="register-password"
        value={password}
        onChange={(value) => {
          setPassword(value);
          setFieldErrors((current) => ({ ...current, password: undefined }));
        }}
        label={t('Create password')}
        error={fieldErrors.password}
        required
        autoComplete="new-password"
      />
      <RoleSelector value={role} onChange={setRole} />
      {error ? <ErrorState id={formErrorId} message={error} /> : null}
      <Button type="submit" disabled={loading}>
        {loading ? t('Creating account...') : t('Register')}
      </Button>
    </form>
  );
}
