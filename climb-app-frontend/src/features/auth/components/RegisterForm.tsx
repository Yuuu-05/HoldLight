import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
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
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleValue>('new_user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({ username, email, password, role });
      navigate(getOnboardingStartRoute(role), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to create account.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Input
        label={t('Username')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
      />
      <Input
        label={t('Email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <PasswordField value={password} onChange={setPassword} label={t('Create password')} />
      <RoleSelector value={role} onChange={setRole} />
      {error ? <ErrorState message={error} /> : null}
      <Button type="submit" disabled={loading}>
        {loading ? t('Creating account...') : t('Register')}
      </Button>
    </form>
  );
}
